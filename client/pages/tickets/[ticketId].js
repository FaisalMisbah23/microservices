import React from 'react'
import useRequest from '../../hooks/use-request'
import Router from 'next/router'

const TicketShow = ({ ticket }) => {
    const { doRequest, errors, isLoading } = useRequest({
        url: '/api/orders',
        method: 'post',
        body: {
            ticketId: ticket.id
        },
        onSuccess: (order) => Router.push('/orders/[orderId]', `/orders/${order.id}`)
    })

    // The API returns orderId on a held ticket. Without this the page looks
    // identical for a free seat and one someone else is holding, and the buyer
    // only finds out from a server error after committing.
    const isReserved = Boolean(ticket.orderId)

    return (
        <div>
            <h1>{ticket.title}</h1>
            <h4>Price: ${ticket.price.toFixed(2)}</h4>
            {isReserved && (
                <div className='alert alert-warning mb-3' role='status'>
                    This ticket is no longer available. It may have been reserved
                    by someone else.
                </div>
            )}
            {errors}
            {!isReserved && (
                <button
                    className='btn btn-primary'
                    onClick={() => doRequest()}
                    disabled={isLoading}
                    aria-busy={isLoading}
                >
                    {isLoading ? 'Reserving...' : 'Purchase'}
                </button>
            )}
        </div>
    )
}

TicketShow.getInitialProps = async (context, client, currentUser) => {
    const { ticketId } = context.query;
    const { data } = await client.get(`/api/tickets/${ticketId}`);

    return { ticket: data };
}

export default TicketShow
