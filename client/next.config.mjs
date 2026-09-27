export default {
    // Pinned to Next 15, which builds with webpack by default. Next 16's
    // build-utils on Vercel require a `routes-manifest-deterministic.json`
    // that Next 16.2.10 never emits, so we step back to the stable major.
    webpack: (config) => {
        config.watchOptions = {
            ...config.watchOptions,
            poll: 300,
            aggregateTimeout: 300,
        };
        return config;
    },
    allowedDevOrigins: ['ticketing.dev'],

    // Local dev only: the client calls relative /api/* paths, which only resolve
    // in production because vercel.json rewrites them to api.buzzapp.dev. Locally
    // they must be rewritten to the dev proxy. Override with QA_API_TARGET.
    async rewrites() {
        const target = process.env.QA_API_TARGET;
        if (!target) return [];
        return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
    }
}