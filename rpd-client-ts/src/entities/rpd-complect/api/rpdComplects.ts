import { axiosBase } from "@shared/api";
import { ComplectData } from "@shared/types";

export const getRpdComplects = async (): Promise<ComplectData[]> => {
  const { data } = await axiosBase.get<ComplectData[]>("get-rpd-complects");
  return data;
};

export const deleteRpdComplects = async (ids: number[]): Promise<void> => {
  await axiosBase.post("delete_rpd_complect", ids);
};
