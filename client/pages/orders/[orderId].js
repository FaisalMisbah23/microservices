import React from 'react'
import useRequest from '../../hooks/use-request'
import Router from 'next/router'
import Link from 'next/link'
import StripeCheckoutModule from 'react-stripe-checkout';

const StripeCheckout = StripeCheckoutModule.default || StripeCheckoutModule;


const OrderShow = ({ order, currentUser, loadError }) => {
    const [timeLeft, setTimeLeft] = React.useState(0);
    const { doRequest, errors, isLoading } = useRequest({
        url: '/api/payments',
        method: 'post',
        body: {
            // order is undefined when getInitialProps returned a loadError, and
            // this hook runs before the guard below, so it must be optional.
            orderId: order?.id
        },
        onSuccess: (payment) => Router.push('/orders')
    });

    React.useEffect(() => {
        if (!order) return;

        const findTimeLeft = () => {
            const msLeft = new Date(order.expiresAt) - new Date();
            setTimeLeft(Math.round(msLeft / 1000)); // for seconds
        }

        findTimeLeft(); // call it once to set the initial time left
        const timerId = setInterval(findTimeLeft, 1000); // for every second

        return () => {
            clearInterval(timerId); // cleanup the interval when the component unmounts
        }
    }, [order]);

    if (loadError) {
        return (
            <div>
                <h1>Order unavailable</h1>
                <p className='text-muted'>{loadError}</p>
                <Link href='/orders' className='btn btn-primary'>Back to My Orders</Link>
            </div>
        )
    }

    if (!order) {
        return <div>Loading order...</div>
    }

    if (timeLeft < 0) {
        return (
            <div>
                <h1>Order Expired</h1>
                <p className='text-muted'>
                    The reservation window for {order.ticket?.title} closed before payment
                    was completed, so the ticket was released.
                </p>
                <Link href='/' className='btn btn-primary'>Browse Tickets</Link>
            </div>
        )
    }

    return (
        <div>
            <h1>Complete your purchase</h1>
            <dl className='row'>
                <dt className='col-sm-3'>Ticket</dt>
                <dd className='col-sm-9'>{order.ticket?.title}</dd>
                <dt className='col-sm-3'>Amount due</dt>
                <dd className='col-sm-9'>${order.ticket?.price?.toFixed(2)}</dd>
                <dt className='col-sm-3'>Order reference</dt>
                <dd className='col-sm-9'><code>{order.id}</code></dd>
            </dl>
            <h4>Time left to pay: {timeLeft} seconds</h4>
            {errors}
            <StripeCheckout
                token={(token) => doRequest({ token: token.id })}
                stripeKey={process.env.NEXT_PUBLIC_STRIPE_KEY}
                amount={order.ticket.price * 100}
                email={currentUser.email} />
        </div>
    )
}

OrderShow.getInitialProps = async (context, client, currentUser) => {
    const { orderId } = context.query;

    // Previously an unguarded await: a 401 signed out rejected straight out of
    // getInitialProps and Next rendered a 500.
    try {
        const { data } = await client.get(`/api/orders/${orderId}`);
        return { order: data };
    } catch (err) {
        const status = err.response?.status;
        if (status === 401) {
            return { loadError: 'Sign in to view this order.' };
        }
        if (status === 404) {
            return { loadError: 'That order does not exist.' };
        }
        return { loadError: 'We could not load this order. Please try again.' };
    }
}

export default OrderShow
