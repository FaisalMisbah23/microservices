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
    const { data } = await client.get('/api/users/currentuser');
    const { currentUser } = data;

    let pageProps = {};
    if (appContext.Component.getInitialProps) {
        // appContext.ctx for getInitialProps of the page component or client for the page component or currentUser for the page component
        pageProps = await appContext.Component.getInitialProps(appContext.ctx, client, currentUser);
    }

    return { pageProps, ...data };
}