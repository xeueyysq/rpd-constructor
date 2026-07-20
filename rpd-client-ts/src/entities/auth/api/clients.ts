import axios from "axios";
import config from "@shared/config";

export const AuthClient = axios.create({
  baseURL: `${config.API_URL}/auth`,
  withCredentials: true,
});
