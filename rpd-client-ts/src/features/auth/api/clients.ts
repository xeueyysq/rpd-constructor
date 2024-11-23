import axios from "axios";
import config from "@shared/config/config.ts";
import inMemoryJWT from "../lib/inMemoryJWT.ts";

export const ResourceClient = axios.create({
    baseURL: `${config.API_URL}/resource`,
});

ResourceClient.interceptors.request.use(
    (config) => {
        const accessToken = inMemoryJWT.getToken();

        if (accessToken) {
            config.headers["Authorization"] = `Bearer ${accessToken}`;
        }

        return config;
    },
    (error) => {
        Promise.reject(error);
    }
);

export const AuthClient = axios.create({
    baseURL: `${config.API_URL}/auth`,
    withCredentials: true,
});