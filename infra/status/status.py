#!/usr/bin/python3
"""Dependency-free status checker for the ticketing stack.

Runs one pass every CHECK_INTERVAL seconds, writes /var/lib/ticketing-status/
current.json, and serves an HTML dashboard on PORT. Only the Python standard
library is used: the VM has no pip and no room for a real monitoring stack.
"""
import json, os, ssl, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timezone

PORT = int(os.environ.get("STATUS_PORT", "3001"))
INTERVAL = int(os.environ.get("CHECK_INTERVAL", "30"))
OUT = os.environ.get("STATUS_OUT", "/var/lib/ticketing-status/current.json")
HIST = os.environ.get("STATUS_HISTORY", "/var/lib/ticketing-status/history.jsonl")

RENDER = {
    "auth":     "https://ticketing-auth-8gms.onrender.com/health",
    "orders":   "https://ticketing-orders.onrender.com/health",
    "tickets":  "https://ticketing-tickets.onrender.com/health",
    "payments": "https://ticketing-payments.onrender.com/health",
}
LOCAL = {
    "nginx-gateway":    "http://127.0.0.1/expiration-health",
    "nats-streaming":   None,   # checked via /varz below
    "redis":            None,   # checked via a PING below
    "expiration-worker":"http://127.0.0.1:3000/health",
}
TIMEOUT = 12

# New Relic APM via NerdGraph. A User key, not the license key the services
# ingest with - that one cannot read anything back. Left unconfigured, the page
# just omits the APM section.
NR_KEY = os.environ.get("NEW_RELIC_API_KEY", "")
NR_ACCOUNT = os.environ.get("NEW_RELIC_ACCOUNT_ID", "8561052")
NR_ENDPOINT = os.environ.get("NEW_RELIC_ENDPOINT", "https://api.newrelic.com/graphql")
NR_SECRET_FILE = "/opt/ticketing/newrelic.secret"

NR_QUERY = """{
  actor {
    entitySearch(query: "type = 'APPLICATION' AND name LIKE 'ticketing-%'") {
      results {
        entities {
          name
          reporting
          ... on ApmApplicationEntityOutline {
            apmSummary { apdexScore errorRate responseTimeAverage instanceCount }
          }
        }
      }
    }
  }
}"""


def probe(name, url):
    t0 = time.monotonic()
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(url, timeout=TIMEOUT, context=ctx) as r:
            r.read(256)
            ms = int((time.monotonic() - t0) * 1000)
            return {"name": name, "status": "up" if r.status == 200 else "degraded",
                    "code": r.status, "ms": ms, "target": url}
    except urllib.error.HTTPError as e:
        return {"name": name, "status": "degraded", "code": e.code,
                "ms": int((time.monotonic() - t0) * 1000), "target": url,
                "error": str(e.reason)}
    except Exception as e:
        return {"name": name, "status": "down", "code": None,
                "ms": int((time.monotonic() - t0) * 1000), "target": url,
                "error": type(e).__name__ + ": " + str(e)[:120]}


def nats_stats():
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen("http://127.0.0.1:8222/varz", timeout=5) as r:
            d = json.loads(r.read())
        return {"name": "nats-streaming", "status": "up",
                "ms": int((time.monotonic() - t0) * 1000),
                "target": "127.0.0.1:8222/varz",
                "detail": {"connections": d.get("connections"),
                           "subscriptions": d.get("subscriptions"),
                           "in_msgs": d.get("in_msgs"),
                           "out_msgs": d.get("out_msgs"),
                           "uptime": d.get("uptime")}}
    except Exception as e:
        return {"name": "nats-streaming", "status": "down", "ms": None,
                "target": "127.0.0.1:8222/varz", "error": str(e)[:120]}


def redis_stats(pw):
    """PING redis using RESP. The server runs with requirepass, so AUTH first."""
    import socket
    t0 = time.monotonic()
    try:
        s = socket.create_connection(("127.0.0.1", 6379), timeout=5)
        s.settimeout(5)
        cmd = b"*2\r\n$4\r\nAUTH\r\n$" + str(len(pw)).encode() + b"\r\n" + pw.encode() + b"\r\n"
        s.sendall(cmd)
        s.recv(64)
        s.sendall(b"*1\r\n$4\r\nPING\r\n")
        resp = s.recv(64)
        s.close()
        ok = b"PONG" in resp
        return {"name": "redis", "status": "up" if ok else "degraded",
                "ms": int((time.monotonic() - t0) * 1000),
                "target": "127.0.0.1:6379"}
    except Exception as e:
        return {"name": "redis", "status": "down", "ms": None,
                "target": "127.0.0.1:6379", "error": str(e)[:120]}


def newrelic_stats(up_names):
    """APM summary per service.

    The interesting signal is not apdex or error rate - it is a service whose
    /health answers 200 while New Relic has stopped hearing from it. That is
    what a half-finished deploy looks like, and the health probe alone cannot
    see it, because the outgoing instance keeps serving.
    """
    key = NR_KEY
    if not key:
        try:
            with open(NR_SECRET_FILE) as f:
                key = f.read().strip()
        except Exception:
            key = ""
    if not key:
        return {"status": "unconfigured", "apps": []}

    t0 = time.monotonic()
    try:
        req = urllib.request.Request(
            NR_ENDPOINT, data=json.dumps({"query": NR_QUERY}).encode(),
            headers={"Content-Type": "application/json", "API-Key": key})
        with urllib.request.urlopen(req, timeout=TIMEOUT,
                                    context=ssl.create_default_context()) as r:
            d = json.loads(r.read())
    except Exception as e:
        return {"status": "error", "apps": [], "account": NR_ACCOUNT,
                "ms": int((time.monotonic() - t0) * 1000),
                "error": type(e).__name__ + ": " + str(e)[:120]}

    if d.get("errors"):
        return {"status": "error", "apps": [], "account": NR_ACCOUNT,
                "ms": int((time.monotonic() - t0) * 1000),
                "error": str(d["errors"][0].get("message", ""))[:120]}

    apps = []
    for e in d["data"]["actor"]["entitySearch"]["results"]["entities"]:
        s = e.get("apmSummary") or {}
        name = e.get("name", "")
        reporting = bool(e.get("reporting"))
        apps.append({
            "name": name,
            "reporting": reporting,
            "silent": name in up_names and not reporting,
            "apdex": s.get("apdexScore"),
            "error_rate": s.get("errorRate"),
            "response_ms": round((s.get("responseTimeAverage") or 0) * 1000, 2),
            "instances": s.get("instanceCount"),
        })
    return {"status": "ok", "apps": apps, "account": NR_ACCOUNT,
            "ms": int((time.monotonic() - t0) * 1000)}


def run_pass(redis_pw):
    checks = [probe(n, u) for n, u in RENDER.items()]
    for n, u in LOCAL.items():
        if n == "nats-streaming":
            continue
        if n == "redis":
            continue
        checks.append(probe(n, u))
    checks.append(nats_stats())
    checks.append(redis_stats(redis_pw))
    up = sum(1 for c in checks if c["status"] == "up")
    up_names = {n for n in RENDER if
                any(c["name"] == n and c["status"] == "up" for c in checks)}
    return {"checked_at": datetime.now(timezone.utc).isoformat(),
            "up": up, "total": len(checks), "checks": checks,
            "newrelic": newrelic_stats(up_names)}


CSS = """
body{font:14px -apple-system,Segoe UI,Roboto,sans-serif;background:#0f1117;color:#e6e6e6;margin:0;padding:2rem}
h1{font-size:1.4rem;margin:0 0 .3rem}h2{font-size:.95rem;margin:2rem 0 .6rem;color:#9aa4b2;font-weight:600}
.sub{color:#7d8794;font-size:.8rem;margin-bottom:1.5rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:.7rem}
.card{background:#171a21;border:1px solid #232732;border-radius:8px;padding:.85rem 1rem;display:flex;justify-content:space-between;align-items:center}
.name{font-weight:600}.tgt{color:#69727f;font-size:.7rem;margin-top:.2rem;word-break:break-all}
.dot{width:9px;height:9px;border-radius:50%;margin-right:.5rem;display:inline-block}
.up{background:#3fb950}.down{background:#f85149}.degraded{background:#d29922}
.ms{color:#9aa4b2;font-variant-numeric:tabular-nums;font-size:.8rem}
.badge{display:inline-block;padding:.3rem .7rem;border-radius:99px;font-size:.8rem;font-weight:600}
.b-ok{background:#1d3b26;color:#3fb950}.b-bad{background:#4a1f1f;color:#f85149}
table{width:100%;border-collapse:collapse;font-size:.78rem;margin-top:.4rem}
th,td{text-align:left;padding:.3rem .5rem;border-bottom:1px solid #232732}
th{color:#7d8794;font-weight:600}code{color:#79c0ff}
"""


def nr_section(nr):
    if not nr or nr.get("status") != "ok":
        note = (nr or {}).get("error") or (nr or {}).get("status") or "unavailable"
        return "<h2>APM (New Relic)</h2><div class=sub>%s</div>" % note
    head = ("<tr><th>service</th><th>reporting</th><th>apdex</th>"
            "<th>error rate</th><th>avg response</th><th>instances</th></tr>")
    body = ""
    for a in nr["apps"]:
        if a["silent"]:
            reporting = '<span class="dot degraded"></span>no &mdash; health check passed but not reporting'
        elif a["reporting"]:
            reporting = '<span class="dot up"></span>yes'
        else:
            reporting = '<span class="dot down"></span>no'

        def cell(v, suffix=""):
            return "&mdash;" if v is None else ("%s%s" % (v, suffix))

        body += ("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
                 % (a["name"], reporting, cell(a["apdex"]), cell(a["error_rate"]),
                    cell(a["response_ms"], " ms"), cell(a["instances"])))
    return ("<h2>APM (New Relic)</h2><div class=sub>account %s</div>"
            "<table>%s%s</table>" % (nr.get("account", "?"), head, body))


def html(data):
    if not data:
        return "<h1>no data yet</h1>"
    ok = data["up"] == data["total"]
    badge = ('<span class="badge b-ok">ALL %d UP</span>' % data["total"]) if ok else \
            ('<span class="badge b-bad">%d/%d UP</span>' % (data["up"], data["total"]))
    rows = "".join(
        '<div class="card"><div><div class="name"><span class="dot %s"></span>%s</div>'
        '<div class="tgt">%s</div></div><div class="ms">%s</div></div>'
        % (c["status"], c["name"], c.get("target", ""),
           ("%d ms" % c["ms"]) if c.get("ms") is not None else c["status"])
        for c in data["checks"])
    det = "".join(
        "<tr><td>%s</td><td><code>%s</code></td></tr>" % (k, v)
        for c in data["checks"] if c.get("detail")
        for k, v in c["detail"].items())
    extra = "<h2>NATS detail</h2><table>%s</table>" % det if det else ""
    return ("<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=30>"
            "<title>Ticketing status</title><style>%s</style>"
            "<h1>Ticketing platform status</h1><div class=sub>%s &middot; "
            "last checked %s &middot; refreshes every %ds</div>%s"
            "<h2>Services</h2><div class=grid>%s</div>%s%s"
            % (CSS, badge, data["checked_at"], INTERVAL, badge, rows, extra,
               nr_section(data.get("newrelic"))))


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        try:
            with open(OUT) as f:
                data = json.load(f)
        except Exception:
            data = None
        if path == "/status.json":
            body = json.dumps(data, indent=2).encode()
            ctype = "application/json"
        else:
            body = html(data).encode()
            ctype = "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


def read_pw():
    for p in ("/opt/ticketing/redis.secret",):
        try:
            with open(p) as f:
                return f.read().strip()
        except Exception:
            pass
    return ""


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    import threading
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    pw = read_pw()
    while True:
        try:
            d = run_pass(pw)
            with open(OUT, "w") as f:
                json.dump(d, f, indent=2)
            with open(HIST, "a") as f:
                f.write(json.dumps({"t": d["checked_at"], "up": d["up"],
                                    "total": d["total"]}) + "\n")
        except Exception as e:
            with open(OUT, "w") as f:
                json.dump({"checked_at": datetime.now(timezone.utc).isoformat(),
                           "up": 0, "total": 0, "checks": [],
                           "error": str(e)[:200]}, f, indent=2)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
