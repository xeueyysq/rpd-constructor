import { useCallback } from "react";
import { isAxiosError } from "axios";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
import type {
  FieldEdit,
  FieldEdits,
  UpdateTemplateFieldResponse,
} from "../model/fieldEdits";
import { useTemplateSync } from "../model/templateSync";

type ConflictResponse = {
  error?: { value: unknown; edit: FieldEdit | null };
};

type SaveResult = { success: boolean; clearDirty: boolean };
type SaveField = (
  field: string,
  value: unknown,
  options?: { keepDraftOnConflict?: boolean }
) => Promise<boolean>;
const queues = new Map<string, Promise<SaveResult>>();
const latestValues = new Map<string, unknown>();

export function useUpdateTemplateField() {
  return useCallback<SaveField>((field, value, options) => {
    const templateId = useStore.getState().jsonData.id;
    if (!templateId) return Promise.resolve(false);
    const key = `${templateId}:${field}`;
    latestValues.set(key, value);
    const revision = useTemplateSync.getState().markDirty(field);

    const run = async (): Promise<SaveResult> => {
      const { jsonData, updateJsonData } = useStore.getState();
      if (jsonData.id !== templateId)
        return { success: false, clearDirty: false };
      const baseAt =
        (jsonData.field_edits as FieldEdits | undefined)?.[field]?.at ?? null;
      try {
        const { data } = await useTemplateSync.getState().track(
          axiosBase.put<UpdateTemplateFieldResponse>(
            `update-json-value/${templateId}`,
            {
              fieldToUpdate: field,
              value,
              baseAt,
            }
          )
        );
        if (useStore.getState().jsonData.id === templateId) {
          updateJsonData(field, data.value);
          if (latestValues.get(key) !== value) {
            updateJsonData(field, latestValues.get(key));
          }
          updateJsonData("field_edits", {
            ...(useStore.getState().jsonData.field_edits as
              FieldEdits | undefined),
            [field]: data.edit,
          });
        }
        return { success: true, clearDirty: true };
      } catch (error) {
        if (
          isAxiosError<ConflictResponse>(error) &&
          error.response?.status === 409
        ) {
          const conflict = error.response.data.error;
          if (conflict && useStore.getState().jsonData.id === templateId) {
            updateJsonData(field, conflict.value);
            const edits = {
              ...(useStore.getState().jsonData.field_edits as
                FieldEdits | undefined),
            };
            if (conflict.edit) edits[field] = conflict.edit;
            else delete edits[field];
            updateJsonData("field_edits", edits);
            const time = conflict.edit
              ? new Date(conflict.edit.at).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "неизвестное время";
            showErrorMessage(
              `Поле уже изменено: ${conflict.edit?.fullname || "другим пользователем"}, ${time}. ${options?.keepDraftOnConflict ? "Черновик оставлен в редакторе. Отмените редактирование, чтобы увидеть актуальное значение" : "Показано актуальное значение"}`
            );
          }
          return { success: false, clearDirty: !options?.keepDraftOnConflict };
        }
        showErrorMessage("Ошибка сохранения данных");
        console.error(error);
        return { success: false, clearDirty: false };
      }
    };

    const previous = queues.get(key);
    const queued = previous
      ? previous.then((result) =>
          result.clearDirty && !result.success ? result : run()
        )
      : run();
    queues.set(key, queued);
    void queued.then((result) => {
      if (queues.get(key) !== queued) return;
      queues.delete(key);
      latestValues.delete(key);
      if (result.clearDirty && useStore.getState().jsonData.id === templateId) {
        useTemplateSync
          .getState()
          .clearDirty(field, result.success ? revision : undefined);
      }
    });
    return queued.then((result) => result.success);
  }, []);
}
