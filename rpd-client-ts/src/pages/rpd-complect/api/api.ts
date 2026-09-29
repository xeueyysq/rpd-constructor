import { axiosBase } from "@shared/api";
import type { ComplectMeta } from "../types";

export async function fetchComplectRpd(
  complectId: string | undefined
): Promise<ComplectMeta> {
  const { data } = await axiosBase.post<ComplectMeta>("find-rpd", {
    complectId,
  });
  return data;
}
