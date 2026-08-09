import React from 'react'

const OrderIndex = ({ orders }) => {
    return (
        <div>
            <h1>Orders</h1>
            <table className='table'>
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Ticket Title</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <tr key={order.id}>
                            <td>{order.id}</td>
                            <td>{order.ticket.title}</td>
                            <td>{order.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

OrderIndex.getInitialProps = async (context, client, currentUser) => {
    const { data } = await client.get('/api/orders');

    return { orders: data };
}

export default OrderIndex
