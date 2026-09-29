import { isAxiosError } from "axios";
import { useMutation } from "@tanstack/react-query";
import { axiosBase } from "@shared/api";

export type Book = {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  url: string | null;
  thumb: string | null;
  biblio: string;
};

export type BookSearchResult = { books: Book[]; truncated: boolean };

export function useFindBooks() {
  return useMutation({
    mutationFn: async (bookName: string) =>
      (await axiosBase.post<BookSearchResult>("find-books", { bookName })).data,
  });
}

export function bookSearchError(error: unknown): string {
  if (isAxiosError<{ error?: unknown }>(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string") return message;
  }
  return "Не удалось выполнить поиск. Попробуйте позже.";
}
