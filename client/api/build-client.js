import axios from "axios"

export default ({ req } = {}) => {
    if (typeof window === 'undefined') {
        // we are on the server (SSR)
        // In production on Vercel, point at the public backend origin.
        // During local minikube dev, fall back to the in-cluster ingress (unchanged).
        const baseURL =
            process.env.BACKEND_URL ||
            'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local'

        return axios.create({
            baseURL,
            headers: req?.headers
        })
    } else {
        // we must be on browser
        // Keep relative '' — Vercel rewrites /api/* to the backend (see vercel.json)
        return axios.create({ baseURL: '/' })
    }

}