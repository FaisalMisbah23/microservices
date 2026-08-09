import React from 'react'
import useRequest from '../../hooks/use-request'
import Router from 'next/router'
import StripeCheckoutModule from 'react-stripe-checkout';

const StripeCheckout = StripeCheckoutModule.default || StripeCheckoutModule;


const OrderShow = ({ order, currentUser }) => {
    const [timeLeft, setTimeLeft] = React.useState(0);
    const { doRequest, errors } = useRequest({
        url: '/api/payments',
        method: 'post',
        body: {
            orderId: order.id
        },
        onSuccess: (payment) => Router.push('/orders')
    });

    React.useEffect(() => {
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

    if (timeLeft < 0) {
        return <div>Order Expired</div>
    }

    return (
        <div>
            <h4>Time left to pay: {timeLeft} seconds</h4>
            <StripeCheckout
                token={(token) => doRequest({ token: token.id })}
                stripeKey={process.env.NEXT_PUBLIC_STRIPE_KEY}
                amount={order.ticket.price * 100}
                email={currentUser.email} />
            {errors}

        </div>
    )
}

OrderShow.getInitialProps = async (context, client, currentUser) => {
    const { orderId } = context.query;
    const { data } = await client.get(`/api/orders/${orderId}`);

    return { order: data };
}

export default OrderShow
