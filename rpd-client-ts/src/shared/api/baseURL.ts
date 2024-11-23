import axios from "axios";
import config from "../config/config.ts";

export const axiosBase = axios.create({
    baseURL: `${config.API_URL}/api/`,
    withCredentials: true,
});