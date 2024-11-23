import axios from "axios";
import config from "@shared/config/config.ts";

export const axiosBase = axios.create({
    baseURL: `${config.API_URL}/api/`,
    withCredentials: true,
});