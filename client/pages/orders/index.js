import React from 'react'
import Link from 'next/link'

const OrderIndex = ({ orders, loadError }) => {
    if (loadError) {
        return (
            <div>
                <h1>Orders</h1>
                <p className='text-muted'>{loadError}</p>
                <Link href='/auth/signin' className='btn btn-primary'>Sign In</Link>
            </div>
        )
    }

    return (
        <div>
            <h1>Orders</h1>
            {orders.length === 0 ? (
                <p className='text-muted'>
                    You have no orders yet.{' '}
                    <Link href='/'>Browse tickets</Link> to get started.
                </p>
            ) : (
                <table className='table'>
                    <caption className='visually-hidden'>Your ticket orders</caption>
                    <thead>
                        <tr>
                            <th scope='col'>Order</th>
                            <th scope='col'>Ticket Title</th>
                            <th scope='col'>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            <tr key={order.id}>
                                <td><code>{order.id.slice(-8)}</code></td>
                                <td>{order.ticket.title}</td>
                                <td>{order.status.replace(':', ' ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}

OrderIndex.getInitialProps = async (context, client, currentUser) => {
    // Previously an unguarded await: a 401 signed out rejected straight out of
    // getInitialProps and Next rendered a 500 for the whole page.
    try {
        const { data } = await client.get('/api/orders');
        return { orders: Array.isArray(data) ? data : [] };
    } catch (err) {
        if (err.response?.status === 401) {
            return { orders: [], loadError: 'Sign in to see your orders.' };
        }
        return { orders: [], loadError: 'We could not load your orders. Please try again.' };
    }
}

export default OrderIndex
