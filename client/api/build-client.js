import axios from 'axios';
import https from 'https';

export default ({ req }) => {
  if (typeof window === 'undefined') {
    // We are on the server (Vercel SSR)
    const headers = { ...req?.headers };
    // Delete host header so Axios uses api.buzzapp.dev instead of forwarding vercel's host
    delete headers.host;

    return axios.create({
      baseURL:
        process.env.BACKEND_URL ||
        'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local',
      headers,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
  } else {
    // We are in the browser
    return axios.create({
      baseURL: '/',
    });
  }
};