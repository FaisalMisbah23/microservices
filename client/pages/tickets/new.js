import React from 'react'
import useRequest from '../../hooks/use-request'
import Router from 'next/router'

const NewTicket = () => {
    const [title, setTitle] = React.useState('');
    const [price, setPrice] = React.useState('');

    const { doRequest, errors, isLoading } = useRequest({
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
                <div className='mb-3'>
                    <label htmlFor='title'>Title</label>
                    <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className='form-control' />
                </div>
                <div className='mb-3'>
                    <label htmlFor='price'>Price</label>
                    <input id="price" value={price} onBlur={onBlur} onChange={(e) => setPrice(e.target.value)} className='form-control' />
                </div>
                {errors}
                <button className='btn btn-primary' disabled={isLoading} aria-busy={isLoading}>
                    {isLoading ? 'Creating...' : 'Submit'}
                </button>
            </form>
        </div >
    )
}

export default NewTicket
