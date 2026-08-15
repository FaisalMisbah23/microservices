import 'bootstrap/dist/css/bootstrap.css'
import buildClient from '../api/build-client'
import Header from '../components/header'

export default function AppComponent({ Component, pageProps, currentUser }) {
    return (
        <div>
            <Header currentUser={currentUser} />
            <div className='container'>
                <Component currentUser={currentUser} {...pageProps} />
            </div>
        </div>
    )
}

// context == {component,ctx:{req,res}}
AppComponent.getInitialProps = async (appContext) => {
    const client = buildClient(appContext.ctx)

    // Fire the session lookup and the page's own data fetch in parallel — the
    // page getInitialProps only needs `client`, so we cut latency from two
    // serial backend round-trips down to one.
    const dataPromise = client.get('/api/users/currentuser').then(({ data }) => data)
    const pagePropsPromise = appContext.Component.getInitialProps
        ? Promise.resolve(appContext.Component.getInitialProps(appContext.ctx, client))
        : Promise.resolve({})

    const [data, pageProps] = await Promise.all([dataPromise, pagePropsPromise])
    const { currentUser } = data;

    return { pageProps, ...data };
}