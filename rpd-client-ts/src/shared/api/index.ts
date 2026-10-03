import axios, { type InternalAxiosRequestConfig } from "axios";
import { axiosBase } from "./clients";
import {
  getAccessToken,
  getSessionGeneration,
  refreshSession,
  SessionChangedError,
} from "./lib/session";

export { axiosBase, axiosAuth } from "./clients";
export {
  applySession,
  beginSession,
  endSession,
  getAccessToken,
  getSessionGeneration,
  refreshSession,
  SessionChangedError,
  subscribeToSession,
} from "./lib/session";
export type { AuthSession } from "./lib/session";

type SessionRequest = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sessionGeneration?: number;
};

axiosBase.interceptors.request.use((config: SessionRequest) => {
  const generation = getSessionGeneration();
  if (
    config._sessionGeneration !== undefined &&
    config._sessionGeneration !== generation
  ) {
    throw new SessionChangedError();
  }
  config._sessionGeneration = generation;
  const token = getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  } else {
    config.headers.delete("Authorization");
  }
  return config;
});

axiosBase.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;
    const originalRequest = error.config as SessionRequest | undefined;
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      throw error;
    }
    if (originalRequest._sessionGeneration !== getSessionGeneration()) {
      throw new SessionChangedError();
    }

    originalRequest._retry = true;
    const token = getAccessToken();
    // Ответ на старый токен мог прийти после уже завершившегося refresh.
    if (
      !token ||
      originalRequest.headers.get("Authorization") === `Bearer ${token}`
    ) {
      await refreshSession();
    }
    if (originalRequest._sessionGeneration !== getSessionGeneration()) {
      throw new SessionChangedError();
    }
    return axiosBase(originalRequest);
  }
);
