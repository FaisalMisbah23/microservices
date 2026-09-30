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
# NRQL over a 1h window barely moves in 30s, and re-running it every pass would
# burn NerdGraph rate limit for numbers that look identical. The health probes
# keep their own cadence; the APM figures refresh on this one.
NR_INTERVAL = int(os.environ.get("NR_INTERVAL", "300"))
NR_WINDOW = os.environ.get("NR_WINDOW", "1 HOUR AGO")
NR_TOP = int(os.environ.get("NR_TOP", "8"))
# Below this many samples a "p95" is just one cold start, and it will outrank a
# route serving hundreds of requests. An endpoint needs repeat traffic before its
# tail latency means anything.
NR_MIN_CALLS = int(os.environ.get("NR_MIN_CALLS", "5"))
_nr_cache = {}

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

# percentile() comes back as {"95": v} rather than a bare number.
NR_APP_NRQL = """SELECT count(*) AS calls, average(duration) AS avg_d,
  percentile(duration, 95) AS p95, max(duration) AS max_d,
  percentage(count(*), WHERE error IS true) AS err_pct
FROM Transaction WHERE appName LIKE 'ticketing-%' SINCE {w} FACET appName"""

NR_ENDPOINT_NRQL = """SELECT count(*) AS calls, average(duration) AS avg_d,
  percentile(duration, 95) AS p95, max(duration) AS max_d
FROM Transaction WHERE appName LIKE 'ticketing-%' SINCE {w}
FACET appName, name LIMIT 60"""


def _nr_key():
    if NR_KEY:
        return NR_KEY
    try:
        with open(NR_SECRET_FILE) as f:
            return f.read().strip()
    except Exception:
        return ""


def _post_nrd(graphql):
    req = urllib.request.Request(
        NR_ENDPOINT, data=json.dumps({"query": graphql}).encode(),
        headers={"Content-Type": "application/json", "API-Key": _nr_key()})
    with urllib.request.urlopen(req, timeout=TIMEOUT,
                                context=ssl.create_default_context()) as r:
        return json.loads(r.read())


def _nrql(sql, cache_key):
    """Run an NRQL query, reusing the last result until NR_INTERVAL passes.

    Returns (results, error_string). On a cached hit the error is None, which is
    how a transient failure stops being re-tried every 30 seconds.
    """
    hit = _nr_cache.get(cache_key)
    if hit and (time.time() - hit[0]) < NR_INTERVAL:
        return hit[1], None
    try:
        d = _post_nrd("""{ actor { account(id: %s) { nrql(query: %s) { results } } } }"""
                      % (NR_ACCOUNT, json.dumps(sql)))
    except Exception as e:
        if hit:
            return hit[1], None
        return None, type(e).__name__ + ": " + str(e)[:120]
    if d.get("errors"):
        msg = str(d["errors"][0].get("message", ""))[:120]
        return None, msg
    res = d["data"]["actor"]["account"]["nrql"]["results"]
    _nr_cache[cache_key] = (time.time(), res)
    return res, None


def _ms(v):
    """NRQL reports Transaction durations in seconds."""
    if v is None or isinstance(v, dict):
        return None
    return round(v * 1000, 2)


def _p95(row):
    v = row.get("p95")
    if isinstance(v, dict):
        v = v.get("95")
    return _ms(v)


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
    key = _nr_key()
    if not key:
        return {"status": "unconfigured", "apps": [], "endpoints": []}

    t0 = time.monotonic()
    try:
        d = _post_nrd(NR_QUERY)
    except Exception as e:
        return {"status": "error", "apps": [], "endpoints": [],
                "account": NR_ACCOUNT,
                "ms": int((time.monotonic() - t0) * 1000),
                "error": type(e).__name__ + ": " + str(e)[:120]}

    if d.get("errors"):
        return {"status": "error", "apps": [], "endpoints": [],
                "account": NR_ACCOUNT,
                "ms": int((time.monotonic() - t0) * 1000),
                "error": str(d["errors"][0].get("message", ""))[:120]}

    # NRQL fills in what the 15-minute apmSummary rollup cannot: tail latency
    # and volume per endpoint. A failure here is non-fatal - the entity data
    # above is still worth showing, so the columns just go empty.
    app_rows, app_err = _nrql(NR_APP_NRQL.format(w=NR_WINDOW), "app")
    ep_rows, ep_err = _nrql(NR_ENDPOINT_NRQL.format(w=NR_WINDOW), "endpoint")
    by_app = {}
    for r in app_rows or []:
        n = r.get("appName") or r.get("facet")
        by_app[n] = r

    apps = []
    for e in d["data"]["actor"]["entitySearch"]["results"]["entities"]:
        s = e.get("apmSummary") or {}
        name = e.get("name", "")
        reporting = bool(e.get("reporting"))
        q = by_app.get(name) or {}
        apps.append({
            "name": name,
            "reporting": reporting,
            "silent": name in up_names and not reporting,
            "apdex": s.get("apdexScore"),
            "error_rate": s.get("errorRate"),
            "response_ms": round((s.get("responseTimeAverage") or 0) * 1000, 2),
            "instances": s.get("instanceCount"),
            "calls": q.get("calls"),
            "p95_ms": _p95(q),
            "max_ms": _ms(q.get("max_d")),
            "err_pct": q.get("err_pct"),
        })

    # A single slow request is noise until it repeats. Rank by p95 so the
    # endpoint table leads with what is consistently slow, not what was slow
    # once - and drop rows too thin to have a meaningful tail.
    eps, thin = [], 0
    for r in ep_rows or []:
        f = r.get("facet")
        app, tx = (f if isinstance(f, list) else [f, r.get("name")])
        p95 = _p95(r)
        if not tx or p95 is None:
            continue
        if (r.get("calls") or 0) < NR_MIN_CALLS:
            thin += 1
            continue
        eps.append({"app": app, "endpoint": tx, "calls": r.get("calls"),
                    "avg_ms": _ms(r.get("avg_d")), "p95_ms": p95,
                    "max_ms": _ms(r.get("max_d"))})
    eps.sort(key=lambda x: (x["p95_ms"], x["calls"] or 0), reverse=True)

    return {"status": "ok", "apps": apps, "endpoints": eps[:NR_TOP],
            "thin": thin, "min_calls": NR_MIN_CALLS,
            "account": NR_ACCOUNT, "window": NR_WINDOW,
            "err": app_err or ep_err,
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


def cell(v, suffix=""):
    if v is None:
        return "&mdash;"
    if isinstance(v, float):
        v = round(v, 4)
    return "%s%s" % (v, suffix)


def nr_section(nr):
    if not nr or nr.get("status") != "ok":
        note = (nr or {}).get("error") or (nr or {}).get("status") or "unavailable"
        return "<h2>APM (New Relic)</h2><div class=sub>%s</div>" % note

    head = ("<tr><th>service</th><th>reporting</th><th>apdex</th>"
            "<th>errors</th><th>avg</th><th>p95</th><th>max</th>"
            "<th>calls/hr</th><th>instances</th></tr>")
    body = ""
    for a in nr["apps"]:
        if a["silent"]:
            reporting = '<span class="dot degraded"></span>no &mdash; health check passed but not reporting'
        elif a["reporting"]:
            reporting = '<span class="dot up"></span>yes'
        else:
            reporting = '<span class="dot down"></span>no'
        err = a.get("err_pct")
        if err:
            errcell = '<span class="dot down"></span>%s%%' % err
        elif err is None:
            errcell = "&mdash;"
        else:
            errcell = "0%"
        body += ("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td>"
                 "<td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
                 % (a["name"], reporting, cell(a["apdex"]), errcell,
                    cell(a["response_ms"], " ms"), cell(a.get("p95_ms"), " ms"),
                    cell(a.get("max_ms"), " ms"), cell(a.get("calls")),
                    cell(a["instances"])))

    out = ("<h2>APM (New Relic)</h2>"
           "<div class=sub>account %s &middot; window %s</div>"
           "<table>%s%s</table>"
           % (nr.get("account", "?"), nr.get("window", "?"), head, body))

    eps = nr.get("endpoints") or []
    if eps:
        ehead = ("<tr><th>service</th><th>endpoint</th><th>calls</th>"
                 "<th>avg</th><th>p95</th><th>max</th></tr>")
        ebody = ""
        for e in eps:
            ebody += ("<tr><td>%s</td><td><code>%s</code></td><td>%s</td>"
                      "<td>%s</td><td>%s</td><td>%s</td></tr>"
                      % (e["app"], e["endpoint"], cell(e["calls"]),
                         cell(e["avg_ms"], " ms"), cell(e["p95_ms"], " ms"),
                         cell(e["max_ms"], " ms")))
        out += ("<h2>Slowest endpoints</h2>"
                "<div class=sub>ranked by p95 &middot; needs %d+ calls in the "
                "window to count%s</div>"
                "<table>%s%s</table>"
                % (nr.get("min_calls", NR_MIN_CALLS),
                   (", %d route%s hidden as too thin to measure"
                    % (nr["thin"], "" if nr["thin"] == 1 else "s")) if nr.get("thin") else "",
                   ehead, ebody))
    elif nr.get("thin"):
        out += ("<h2>Slowest endpoints</h2><div class=sub>no endpoint reached "
                "%d calls in the window - traffic is too thin to measure a tail"
                % nr.get("min_calls", NR_MIN_CALLS))

    if nr.get("err"):
        out += ('<div class=sub style="color:#d29922">NRQL partial: %s</div>'
                % nr["err"])
    return out


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
