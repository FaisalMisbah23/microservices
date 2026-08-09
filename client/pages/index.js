import React from 'react'
import buildClient from '../api/build-client'
import Link from 'next/link'

export default function Landing({ currentUser, tickets }) {
    return (
        <div>
            <h1>Tickets</h1 >
            <table className='table'>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Price</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>
                    {tickets.map((ticket) => (
                        <tr key={ticket.id}>
                            <td>{ticket.title}</td>
                            <td>{ticket.price}</td>
                            <td><Link href={`/tickets/${ticket.id}`}>View</Link></td>
                        </tr>
                    ))}
                </tbody>
            </table >
        </div >
    )
}

Landing.getInitialProps = async (context, client, currentUser) => {
    const { data } = await client.get('/api/tickets');

    return { tickets: data };
}