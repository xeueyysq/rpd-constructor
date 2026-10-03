import axios from "axios";
import config from "@shared/config";

export const axiosBase = axios.create({
  baseURL: `${config.API_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

export const axiosAuth = axios.create({
  baseURL: `${config.API_URL}/auth`,
  timeout: 5000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
