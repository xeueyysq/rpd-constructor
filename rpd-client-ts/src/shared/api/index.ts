import axios from "axios"
import config from "../config"

export const axiosBase = axios.create({
    baseURL: `${config.API_URL}/api/`,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Add interceptor for handling errors
axiosBase.interceptors.response.use(
    response => response,
    error => {
        console.error('API Error:', error)
        return Promise.reject(error)
    }
)
