import React from 'react'
import useRequest from '../../hooks/use-request'
import Router from 'next/router'

const TicketShow = ({ ticket, loadError }) => {
    const { doRequest, errors, isLoading } = useRequest({
        url: '/api/orders',
        method: 'post',
        body: {
            ticketId: ticket.id
        },
        onSuccess: (order) => Router.push('/orders/[orderId]', `/orders/${order.id}`)
    })

    if (loadError || !ticket) {
        return (
            <div>
                <h1>Ticket unavailable</h1>
                <p className='text-muted'>{loadError || 'That ticket does not exist.'}</p>
            </div>
        )
    }

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

    // Previously unguarded: any backend error rejected out of getInitialProps
    // and Next rendered a 500 for the whole page.
    try {
        const { data } = await client.get(`/api/tickets/${ticketId}`);
        return { ticket: data };
    } catch (err) {
        if (err.response?.status === 404) {
            return { loadError: 'That ticket does not exist.' };
        }
        return { loadError: 'We could not load this ticket. Please try again.' };
    }
}

export default TicketShow
