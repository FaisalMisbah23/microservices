import React from 'react'

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

Landing.initialProps = async () => {
    const response = await axios.get('/api/users/currentuser').catch(err => {
        console.log(err);
    });
    return response.data
}