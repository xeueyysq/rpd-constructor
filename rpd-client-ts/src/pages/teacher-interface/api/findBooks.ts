import { isAxiosError } from "axios";
import { useMutation } from "@tanstack/react-query";
import { axiosBase } from "@shared/api";

export type BookSource = "megapro" | "lan" | "urait";

export const bookSourceLabels: Record<BookSource, string> = {
  megapro: "МегаПро",
  lan: "Лань",
  urait: "Юрайт",
};

export type Book = {
  id: string;
  source: BookSource;
  title: string;
  author: string | null;
  year: number | null;
  url: string | null;
  thumb: string | null;
  biblio: string;
};

export type BookSearchResult = {
  books: Book[];
  truncated: boolean;
  unavailableSources?: BookSource[];
};

export function useFindBooks() {
  return useMutation({
    mutationFn: async (request: { bookName: string }) =>
      (await axiosBase.post<BookSearchResult>("find-books", request)).data,
  });
}

export function bookSearchError(error: unknown): string {
  if (isAxiosError<{ error?: unknown }>(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string") return message;
  }
  return "Не удалось выполнить поиск. Попробуйте позже.";
}
