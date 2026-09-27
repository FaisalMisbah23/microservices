import { useState } from "react";
import axios from "axios";

export default function useRequest({ url, method, body, onSuccess }) {
    const [errors, setErrors] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const doRequest = async (props = {}) => {
        setIsLoading(true);
        try {
            setErrors(null);
            const response = await axios[method](url, { ...body, ...props });
            if (onSuccess) {
                onSuccess(response.data);
            }
            return response.data;
        } catch (err) {
            setErrors(
                <div className="alert alert-danger" role="alert">
                    <ul className="my-0">
                        {err.response?.data.errors.map((err) => (
                            <li key={err.message}>{err.message}</li>
                        ))}
                    </ul>
                </div>
            );
        } finally {
            setIsLoading(false);
        }
    }
    return { doRequest, errors, isLoading }
}