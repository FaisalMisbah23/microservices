import useRequest from "../../hooks/use-request"
import router from 'next/router';
import { useEffect } from "react"

export default function Signout() {

    const { doRequest } = useRequest({
        url: '/api/users/signout',
        method: 'post',
        body: {},
        onSuccess: () => router.push('/')

    })

    useEffect(() => {
        doRequest();
    }, [])

    return <div>Signing you out...</div>
}