import axios from "axios";
import { axiosAuth } from "../clients";

export type AuthSession = {
  accessToken: string;
  accessTokenExpiration: number;
  role: number;
  fullname: { name: string; surname: string; patronymic: string };
};

type SessionHandlers = {
  onRefreshed: (session: AuthSession) => void;
  onExpired: () => void;
};

export class SessionChangedError extends Error {
  constructor() {
    super("Сессия изменилась");
  }
}

let accessToken: string | null = null;
let generation = 0;
let sessionError: unknown;
let refreshPromise: Promise<AuthSession> | null = null;
let refreshController: AbortController | null = null;
let handlers: SessionHandlers | null = null;

export const getAccessToken = () => accessToken;
export const getSessionGeneration = () => generation;

export function subscribeToSession(next: SessionHandlers) {
  handlers = next;
  return () => {
    if (handlers === next) handlers = null;
  };
}

export function beginSession() {
  generation += 1;
  refreshController?.abort();
  refreshController = null;
  accessToken = null;
  refreshPromise = null;
  sessionError = undefined;
  return generation;
}

export function endSession(error: unknown = new SessionChangedError()) {
  beginSession();
  sessionError = error;
}

export function applySession(session: AuthSession, expectedGeneration: number) {
  if (expectedGeneration !== generation) throw new SessionChangedError();
  accessToken = session.accessToken;
  handlers?.onRefreshed(session);
  return session;
}

// Загрузка, таймер и интерцептор разделяют один запрос на поколение сессии.
export function refreshSession(): Promise<AuthSession> {
  if (sessionError !== undefined) return Promise.reject(sessionError);
  if (refreshPromise) return refreshPromise;
  const expectedGeneration = generation;
  const controller = new AbortController();
  refreshController = controller;
  const promise = axiosAuth
    .post<AuthSession>("/refresh", undefined, { signal: controller.signal })
    .then(({ data }) => applySession(data, expectedGeneration))
    .catch((error: unknown) => {
      if (expectedGeneration !== generation) throw new SessionChangedError();
      if (
        axios.isAxiosError(error) &&
        [401, 403].includes(error.response?.status ?? 0)
      ) {
        endSession(error);
        handlers?.onExpired();
      }
      throw error;
    })
    .finally(() => {
      // Старый refresh не должен очистить промис новой сессии.
      if (refreshPromise === promise) refreshPromise = null;
      if (refreshController === controller) refreshController = null;
    });
  refreshPromise = promise;
  return promise;
}
