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
    allowedDevOrigins: ['ticketing.dev']
}