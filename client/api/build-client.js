import axios from "axios"
import https from "https"

// Public tunnel to the deployed backend (same host the browser reaches via the
// /api rewrite in vercel.json). The in-cluster URI is only reachable from inside
// the minikube network, so it must never be used on Vercel.
const PUBLIC_BACKEND_URL = 'https://api.161.118.209.104.nip.io'
const IN_CLUSTER_BACKEND_URL = 'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local'

export default ({ req } = {}) => {
    if (typeof window === 'undefined') {
        // we are on the server (SSR)
        // Vercel builds expose VERCEL=1, so SSR requests hit the public origin;
        // during local minikube dev we fall back to the in-cluster ingress.
        const baseURL =
            process.env.BACKEND_URL ||
            (process.env.VERCEL ? PUBLIC_BACKEND_URL : IN_CLUSTER_BACKEND_URL)

        // Forward cookies so the backend can identify the user, but never the
        // incoming Host header — it only resolves against the in-cluster ingress
        // and would make the public backend route the request to /404.
        const headers = req?.headers ? { ...req.headers } : undefined
        if (baseURL === PUBLIC_BACKEND_URL) {
            delete headers?.host
        }

        return axios.create({
            baseURL,
            headers,
            // The public backend redirects to HTTPS behind a self-signed cert, so
            // Node must skip TLS verification when talking to it directly.
            ...(baseURL === PUBLIC_BACKEND_URL && {
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            })
        })
    } else {
        // we must be on browser
        // Keep relative '' — Vercel rewrites /api/* to the backend (see vercel.json)
        return axios.create({ baseURL: '/' })
    }

}