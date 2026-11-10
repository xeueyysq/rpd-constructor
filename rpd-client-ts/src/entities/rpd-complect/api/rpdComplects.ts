import { axiosBase } from "@shared/api";
import { ComplectData } from "@shared/types";

export const getRpdComplects = async (): Promise<ComplectData[]> => {
  const { data } = await axiosBase.get<ComplectData[]>("get-rpd-complects");
  return data;
};

export const deleteRpdComplects = async (ids: string[]): Promise<void> => {
  await axiosBase.post("delete_rpd_complect", ids);
};

export const assignComplectOwners = async ({
  complectId,
  userIds,
  baseUserIds,
}: {
  complectId: number;
  userIds: number[];
  baseUserIds: number[];
}) => {
  const { data } = await axiosBase.put<{
    complectId: number;
    userIds: number[];
  }>(`complects/${complectId}/owners`, {
    userIds,
    baseUserIds,
  });
  return data;
};
