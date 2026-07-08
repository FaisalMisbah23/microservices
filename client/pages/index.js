import React from 'react'
import buildClient from '../api/build-client'

export default function Landing({ currentUser }) {
    return (
        <div>
            <h1>Landing Page</h1>
            {currentUser ? (
                <h2>Welcome, {currentUser.email}</h2>
            ) : (
                <h2>Please sign in or sign up.</h2>
            )}
        </div>
    )
}

Landing.getInitialProps = async (context) => {
    const client = buildClient(context)
    const { data } = await client.get('/api/users/currentuser');
    return data;
}