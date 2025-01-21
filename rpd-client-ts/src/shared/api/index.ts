import axios from "axios"
import config from "@shared/config"

export const axiosBase = axios.create({
    baseURL: `${config.API_URL}/api`,
    timeout: 5000,
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

// Создаем отдельный инстанс для аутентификации
export const axiosAuth = axios.create({
    baseURL: `${config.API_URL}/auth`,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
})

axiosAuth.interceptors.response.use(
    response => response,
    error => {
        console.error('Auth Error:', error)
        return Promise.reject(error)
    }
)
