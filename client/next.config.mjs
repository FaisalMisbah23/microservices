export default {
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