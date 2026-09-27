import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { changedCleanFields } from "../lib/fieldEdits";
import type { FieldEdits, TemplatePresenceResponse } from "../model/fieldEdits";
import { useTemplateSync } from "../model/templateSync";

export function useTemplatePresence(templateId: number | undefined) {
  const data = useQuery({
    queryKey: ["template-presence", templateId],
    queryFn: async () =>
      (
        await axiosBase.post<TemplatePresenceResponse>(
          `templates/${templateId}/presence`
        )
      ).data,
    enabled: templateId != null,
    refetchInterval:
      Number(import.meta.env.VITE_PRESENCE_INTERVAL_MS) || 20_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!data.data || templateId == null) return;
    const current = useStore.getState().jsonData;
    if (current.id !== templateId) return;
    const changed = changedCleanFields(
      (current.field_edits as FieldEdits | undefined) ?? {},
      data.data.fieldEdits,
      useTemplateSync.getState().dirty
    );
    if (!changed.length) return;

    let cancelled = false;
    void axiosBase
      .post<Record<string, unknown>>("rpd-profile-templates", {
        id: templateId,
      })
      .then(({ data: profile }) => {
        if (cancelled || useStore.getState().jsonData.id !== templateId) return;
        const { updateJsonData } = useStore.getState();
        const profileEdits =
          (profile.field_edits as FieldEdits | undefined) ?? {};
        const mergedEdits = {
          ...((useStore.getState().jsonData.field_edits as
            FieldEdits | undefined) ?? {}),
        };
        const dirty = useTemplateSync.getState().dirty;
        const refreshed = new Set<string>();
        for (const field of changed) {
          const localAt = mergedEdits[field]?.at;
          const nextAt = profileEdits[field]?.at;
          if (dirty[field] || !nextAt || (localAt && localAt >= nextAt))
            continue;
          updateJsonData(field, profile[field]);
          mergedEdits[field] = profileEdits[field];
          refreshed.add(field);
        }
        if (!refreshed.size) return;
        if (
          (refreshed.has("study_load") || refreshed.has("zet")) &&
          !dirty.study_plan_hours
        ) {
          updateJsonData("study_plan_hours", profile.study_plan_hours);
        }
        if (
          (refreshed.has("certification") || refreshed.has("control_load")) &&
          !dirty.certification
        ) {
          updateJsonData(
            "certification",
            profile.certification || profile.derived_certification
          );
        }
        updateJsonData("field_edits", mergedEdits);
      })
      .catch((error) => console.error("Ошибка обновления шаблона", error));
    return () => {
      cancelled = true;
    };
  }, [data.data, templateId]);

  return data;
}
