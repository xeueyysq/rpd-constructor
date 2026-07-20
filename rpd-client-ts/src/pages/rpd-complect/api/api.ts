import { axiosBase } from "@shared/api";
import type {
  ComplectMeta,
  CreateTemplateDataParams,
  CreateTemplateResponse,
} from "../types";

export async function fetchComplectRpd(
  complectId: string | undefined
): Promise<ComplectMeta> {
  const { data } = await axiosBase.post<ComplectMeta>("find-rpd", {
    complectId,
  });
  return data;
}

export async function createProfileTemplateFrom1c(
  params: CreateTemplateDataParams
): Promise<CreateTemplateResponse> {
  const { data } = await axiosBase.post<CreateTemplateResponse>(
    "create-profile-template-from-1c",
    params
  );
  return data;
}
