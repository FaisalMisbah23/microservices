import React, { useState } from 'react'
import axios from 'axios'
import useRequest from '../../hooks/use-request';
import router from 'next/router';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { doRequest, errors, isLoading } = useRequest({
        url: '/api/users/signup',
        method: 'post',
        body: { email, password },
        onSuccess: () => router.push('/')
    });

    const onSubmit = async (e) => {
        e.preventDefault();

        await doRequest();
    }

    return (
        <form onSubmit={onSubmit}>
            <h1>Sign Up</h1>
            <div className="mb-3">
                <label htmlFor='email'>Email Address</label>
                <input id="email" type='email' value={email} onChange={(e) => setEmail(e.target.value)} className="form-control" />
            </div>
            <div className="mb-3">
                <label htmlFor='password'>Password</label>
                <input id="password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="form-control" />
            </div>
            {errors}
            <button className="btn btn-primary" disabled={isLoading} aria-busy={isLoading}>
                {isLoading ? 'Creating account...' : 'Sign Up'}
            </button>
        </form>
    )
}
