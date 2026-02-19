import axios from "axios";
import config from "@shared/config";

export const axiosBase = axios.create({
  baseURL: `${config.API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

let accessToken: string | null = null;

export const setAccessToken = (token?: string) => {
  accessToken = token ?? null;
};

axiosBase.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

axiosBase.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status: number | undefined = error?.response?.status;
    const originalRequest = error?.config as
      | (import("axios").InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      (status === 401 || status === 403) &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        const res = await axiosAuth.post("/refresh");
        const newAccessToken: string | undefined = res?.data?.accessToken;
        if (newAccessToken) {
          setAccessToken(newAccessToken);
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosBase(originalRequest);
        }
      } catch (refreshError) {
        console.error("Auth refresh failed:", refreshError);
      }
    }

    console.error("API Error:", error);
    return Promise.reject(error);
  }
);

export const axiosAuth = axios.create({
  baseURL: `${config.API_URL}/auth`,
  timeout: 5000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosAuth.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("Auth Error:", error);
    return Promise.reject(error);
  }
);
