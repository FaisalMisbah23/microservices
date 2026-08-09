import React from 'react'
import useRequest from '../../hooks/use-request'
import Router from 'next/router'

const NewTicket = () => {
    const [title, setTitle] = React.useState('');
    const [price, setPrice] = React.useState('');

    const { doRequest, errors } = useRequest({
        url: '/api/tickets',
        method: 'post',
        body: {
            title, price
        },
        onSuccess: (ticket) => Router.push('/')
    })

    const onSubmit = (event) => {
        event.preventDefault();
        doRequest();
    }

    const onBlur = () => {
        // parseFloat: convert string to number
        const value = parseFloat(price);
        if (isNaN(value)) {
            return;
        }
        setPrice(value.toFixed(2));
    }

    return (
        <div>
            <h1>Create a New Ticket</h1>
            <form onSubmit={onSubmit}>
                <div className='form-group'>
                    <label>Title</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className='form-control' />
                </div>
                <div className='form-group'>
                    <label>Price</label>
                    <input value={price} onBlur={onBlur} onChange={(e) => setPrice(e.target.value)} className='form-control' />
                </div>
                {errors}
                <button className='btn btn-primary'>Submit</button>
            </form>
        </div >
    )
}

export default NewTicket
