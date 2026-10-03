import { axiosBase } from "@shared/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MyTemplate,
  TemplateWorkflow,
  WorkflowAction,
} from "../model/workflow";
import { templateHistoryKey } from "./history";

const workflowKey = (id: number) => ["template-workflow", id] as const;
const myTemplatesKey = ["my-templates"] as const;

export function useTemplateWorkflow(id: number | undefined) {
  return useQuery({
    queryKey: workflowKey(id ?? 0),
    queryFn: async () =>
      (await axiosBase.get<TemplateWorkflow>(`templates/${id}/workflow`)).data,
    enabled: id != null,
  });
}

export function useMyTemplates() {
  return useQuery({
    queryKey: myTemplatesKey,
    queryFn: async () =>
      (await axiosBase.get<MyTemplate[]>("my-templates")).data,
  });
}

export function useWorkflowAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      action,
      userId,
      comment,
    }: {
      templateId: number;
      action: WorkflowAction;
      userId?: number;
      comment?: string;
    }) =>
      (
        await axiosBase.post<TemplateWorkflow>(
          `templates/${templateId}/workflow`,
          { action, userId, comment }
        )
      ).data,
    onSuccess: (snapshot) => {
      queryClient.setQueryData(workflowKey(snapshot.templateId), snapshot);
      void queryClient.invalidateQueries({ queryKey: ["rpd-complect"] });
      void queryClient.invalidateQueries({ queryKey: myTemplatesKey });
      void queryClient.invalidateQueries({
        queryKey: templateHistoryKey(snapshot.templateId),
      });
    },
  });
}
