import { axiosBase } from "@shared/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TemplateWorkflow } from "@entities/template";

export interface CreateFrom1cParams {
  id_1c: number;
  complectId: number;
  teacherIds: number[];
}

export function useCreateTemplateFrom1c() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: CreateFrom1cParams) =>
      (
        await axiosBase.post<TemplateWorkflow>(
          "create-profile-template-from-1c",
          params
        )
      ).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["rpd-complect"] }),
  });
}
