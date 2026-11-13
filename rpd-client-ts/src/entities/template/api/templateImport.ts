import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  axiosBase,
  getSessionGeneration,
  SessionChangedError,
} from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
import { useTemplateSync } from "../model/templateSync";
import type { FieldEdit, FieldEdits } from "../model/fieldEdits";
import type {
  CopyTemplateResponse,
  ImportCatalogQuery,
  ImportCatalogResponse,
  ImportComplectResponse,
  ImportContext,
  ImportField,
  ImportFieldPreview,
  ImportSources,
  ImportSourceDetailsQuery,
  WordImportApplyResponse,
  WordImportField,
  WordImportPreview,
  WordValues,
} from "../model/templateImport";

// Дожидаемся уже начатых сохранений. Несохранённый редактор не закрываем.
export async function prepareTemplateImport(templateId: number) {
  const generation = getSessionGeneration();
  if (useStore.getState().jsonData.id !== templateId) return;
  while (useTemplateSync.getState().pending) {
    await new Promise<void>((resolve) => {
      const unsubscribe = useTemplateSync.subscribe((state) => {
        if (!state.pending) {
          unsubscribe();
          resolve();
        }
      });
    });
    // track завершает HTTP раньше, чем очередь useUpdateTemplateField снимает
    // dirty. Следующая задача даёт завершиться всей цепочке Promise очереди.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    requireSession(generation);
  }
  if (
    useStore.getState().jsonData.id === templateId &&
    Object.keys(useTemplateSync.getState().dirty).length
  ) {
    throw new Error("Сначала сохраните или отмените локальные изменения РПД");
  }
}

function requireSession(generation: number) {
  if (generation !== getSessionGeneration()) throw new SessionChangedError();
}

export function templateImportError(error: unknown) {
  if (isAxiosError(error) && error.response?.status === 409) {
    return "Данные изменились другим пользователем. Обновите данные и подтвердите действие повторно.";
  }
  return error instanceof Error && !isAxiosError(error)
    ? error.message
    : "Не удалось выполнить действие. Попробуйте ещё раз или обновите данные.";
}

export function useImportSources(context: ImportContext, enabled = true) {
  const generation = getSessionGeneration();
  return useQuery({
    queryKey: ["template-import-sources", generation, context],
    queryFn: async ({ signal }) => {
      if (context.targetTemplateId != null)
        await prepareTemplateImport(Number(context.targetTemplateId));
      else {
        const active = useStore.getState().jsonData;
        if (
          active.id &&
          String(active.id_rpd_complect) === String(context.targetComplectId)
        )
          await prepareTemplateImport(active.id);
      }
      requireSession(generation);
      const result = (
        await axiosBase.get<ImportSources>("template-import/sources", {
          params: context,
          signal,
        })
      ).data;
      requireSession(generation);
      return result;
    },
    enabled: enabled && validImportContext(context),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    refetchOnMount: "always",
    retry: false,
  });
}

function validImportContext(context: ImportContext): boolean {
  return (
    (context.targetTemplateId != null &&
      String(context.targetTemplateId).trim() !== "") !==
    (context.targetComplectId != null &&
      String(context.targetComplectId).trim() !== "")
  );
}

async function prepareImportContext(
  context: ImportContext,
  generation: number
) {
  if (context.targetTemplateId != null)
    await prepareTemplateImport(Number(context.targetTemplateId));
  else {
    const active = useStore.getState().jsonData;
    if (
      active.id &&
      String(active.id_rpd_complect) === String(context.targetComplectId)
    )
      await prepareTemplateImport(active.id);
  }
  requireSession(generation);
}

export function useImportCatalog(query: ImportCatalogQuery, enabled = true) {
  const generation = getSessionGeneration();
  return useQuery({
    queryKey: ["template-import-catalog", generation, query],
    queryFn: async ({ signal }) => {
      await prepareImportContext(query, generation);
      const result = (
        await axiosBase.get<ImportCatalogResponse>("template-import/catalog", {
          params: query,
          signal,
        })
      ).data;
      requireSession(generation);
      return result;
    },
    enabled: enabled && validImportContext(query),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: "always",
    retry: false,
  });
}

export function useImportSourceDetails(
  query: ImportSourceDetailsQuery,
  enabled = true
) {
  const generation = getSessionGeneration();
  return useQuery({
    queryKey: ["template-import-source-details", generation, query],
    queryFn: async ({ signal }) => {
      await prepareImportContext(query, generation);
      const result = (
        await axiosBase.get<ImportSources>("template-import/sources", {
          params: query,
          signal,
        })
      ).data;
      requireSession(generation);
      return result;
    },
    enabled:
      enabled &&
      validImportContext(query) &&
      query.sourceComplectId != null &&
      String(query.sourceComplectId).trim() !== "",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: "always",
    retry: false,
  });
}

export function useImportFieldPreview(
  ids: number[],
  rowName: ImportField,
  targetTemplateId: number,
  enabled: boolean,
  ownOnly?: boolean
) {
  const generation = getSessionGeneration();
  return useQuery({
    queryKey: [
      "template-import-preview",
      generation,
      ids,
      rowName,
      targetTemplateId,
      ownOnly,
    ],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        rowName,
        targetTemplateId: String(targetTemplateId),
      });
      if (ownOnly !== undefined) params.set("ownOnly", String(ownOnly));
      ids.forEach((id) => params.append("ids", String(id)));
      const result = (
        await axiosBase.get<ImportFieldPreview[]>("get-changeable-values", {
          params,
          signal,
        })
      ).data;
      requireSession(generation);
      return result;
    },
    enabled: enabled && ids.length > 0,
  });
}

function syncField(
  templateId: number,
  field: string,
  value: unknown,
  edit: FieldEdit | null
) {
  const { jsonData, updateJsonData } = useStore.getState();
  if (jsonData.id !== templateId) return;
  updateJsonData(field, value);
  const edits = { ...(jsonData.field_edits as FieldEdits | undefined) };
  if (edit) edits[field] = edit;
  else delete edits[field];
  updateJsonData("field_edits", edits);
}

async function changeField<T extends { value?: unknown; edit?: FieldEdit }>(
  templateId: number,
  field: string,
  send: () => Promise<T>
) {
  const generation = getSessionGeneration();
  await prepareTemplateImport(templateId);
  requireSession(generation);
  const active = useStore.getState().jsonData.id === templateId;
  const revision = active
    ? useTemplateSync.getState().markDirty(field)
    : undefined;
  try {
    const data = await useTemplateSync.getState().track(send());
    requireSession(generation);
    if (data.edit) syncField(templateId, field, data.value, data.edit);
    return data;
  } catch (error) {
    requireSession(generation);
    if (
      isAxiosError<{ error?: { value: unknown; edit: FieldEdit | null } }>(
        error
      ) &&
      error.response?.status === 409
    ) {
      const conflict = error.response.data.error;
      if (conflict) syncField(templateId, field, conflict.value, conflict.edit);
    }
    throw error;
  } finally {
    if (
      generation === getSessionGeneration() &&
      active &&
      useStore.getState().jsonData.id === templateId
    )
      useTemplateSync.getState().clearDirty(field, revision);
  }
}

export function useCopyTemplateField() {
  return useMutation({
    mutationFn: (params: {
      sourceTemplateId: number;
      targetTemplateId: number;
      fieldToCopy: ImportField;
      baseAt: string | null;
      ownOnly?: boolean;
    }) =>
      changeField(
        params.targetTemplateId,
        params.fieldToCopy,
        async () =>
          (
            await axiosBase.post<CopyTemplateResponse>(
              "copy-template-data",
              params
            )
          ).data
      ),
    retry: false,
  });
}

export function useClearTemplateControl() {
  return useMutation({
    mutationFn: (params: {
      templateId: number;
      rowId: string;
      baseAt: string | null;
    }) =>
      changeField(
        params.templateId,
        "content",
        async () =>
          (
            await axiosBase.post<{
              field: "content";
              value: unknown;
              edit: FieldEdit;
            }>(`templates/${params.templateId}/content-control/clear`, {
              rowId: params.rowId,
              baseAt: params.baseAt,
            })
          ).data
      ),
    retry: false,
  });
}

export function useCopyTemplateContent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      sourceTemplateId: number;
      targetTemplateId: number;
      targetRevision: string;
      ownOnly?: boolean;
    }) => {
      const generation = getSessionGeneration();
      await prepareTemplateImport(params.targetTemplateId);
      requireSession(generation);
      const data = await useTemplateSync
        .getState()
        .track(
          axiosBase.post<CopyTemplateResponse>("copy-template-content", params)
        );
      requireSession(generation);
      const { jsonData, setJsonData } = useStore.getState();
      if (jsonData.id === params.targetTemplateId)
        setJsonData({
          ...jsonData,
          ...data.data.targetTemplate,
          certification:
            data.data.targetTemplate.certification || jsonData.certification,
        });
      return data.data;
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["rpd-complect"] }),
        client.invalidateQueries({ queryKey: ["my-templates"] }),
        client.invalidateQueries({ queryKey: ["template-history"] }),
        client.invalidateQueries({ queryKey: ["template-presence"] }),
      ]),
    retry: false,
  });
}

const MAX_WORD_BYTES = 5 * 1024 * 1024;

export async function previewFile(
  targetTemplateId: number,
  file: File,
  signal?: AbortSignal
): Promise<WordImportPreview> {
  if (!file.name.toLowerCase().endsWith(".docx") || file.name.length > 200)
    throw new Error("Выберите файл .docx");
  if (!file.size || file.size > MAX_WORD_BYTES)
    throw new Error("DOCX должен быть не больше 5 МБ");
  const generation = getSessionGeneration();
  const startedInTargetEditor =
    useStore.getState().jsonData.id === targetTemplateId;
  await prepareTemplateImport(targetTemplateId);
  requireSession(generation);
  if (
    startedInTargetEditor &&
    useStore.getState().jsonData.id !== targetTemplateId
  )
    throw new Error("Открыта другая РПД. Повторите предпросмотр");
  const form = new FormData();
  form.set("file", file);
  const result = (
    await axiosBase.post<WordImportPreview>(
      `templates/${targetTemplateId}/import-word/preview`,
      form,
      { signal }
    )
  ).data;
  requireSession(generation);
  if (
    startedInTargetEditor &&
    useStore.getState().jsonData.id !== targetTemplateId
  )
    throw new Error("Открыта другая РПД. Повторите предпросмотр");
  return result;
}

export function useWordImportPreview() {
  return useMutation({
    mutationFn: ({
      targetTemplateId,
      file,
      signal,
    }: {
      targetTemplateId: number;
      file: File;
      signal?: AbortSignal;
    }) => previewFile(targetTemplateId, file, signal),
    retry: false,
  });
}

export function useWordImportApply() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetTemplateId,
      expectedRevision,
      mode,
      selectedFields,
      values,
    }: {
      targetTemplateId: number;
      expectedRevision: string;
      mode: "append" | "replace";
      selectedFields: WordImportField[];
      values: WordValues;
    }) => {
      const generation = getSessionGeneration();
      const startedInTargetEditor =
        useStore.getState().jsonData.id === targetTemplateId;
      await prepareTemplateImport(targetTemplateId);
      requireSession(generation);
      if (
        startedInTargetEditor &&
        useStore.getState().jsonData.id !== targetTemplateId
      )
        throw new Error("Открыта другая РПД. Повторите импорт");
      const selectedValues = Object.fromEntries(
        selectedFields.map((field) => [field, values[field]])
      );
      const request = axiosBase.post<WordImportApplyResponse>(
        `templates/${targetTemplateId}/import-word/apply`,
        { expectedRevision, mode, selectedFields, values: selectedValues }
      );
      const data = (
        await (startedInTargetEditor
          ? useTemplateSync.getState().track(request)
          : request)
      ).data;
      requireSession(generation);
      const { jsonData, setJsonData } = useStore.getState();
      if (startedInTargetEditor && jsonData.id !== targetTemplateId)
        throw new Error("Открыта другая РПД. Обновите её перед продолжением");
      if (startedInTargetEditor)
        setJsonData({
          ...jsonData,
          ...data.targetTemplate,
          certification:
            data.targetTemplate.certification || jsonData.certification,
        });
      return data;
    },
    onSuccess: () =>
      Promise.all(
        [
          "rpd-complect",
          "my-templates",
          "template-history",
          "template-presence",
        ].map((key) => client.invalidateQueries({ queryKey: [key] }))
      ),
    retry: false,
  });
}

export function useImportComplect() {
  const client = useQueryClient();
  const generation = getSessionGeneration();
  return useMutation({
    mutationFn: async (params: {
      sourceComplectId: number;
      targetComplectId: number | string;
      targetRevision: string;
      sourceStatus?: ImportCatalogQuery["status"] | null;
    }) => {
      requireSession(generation);
      const active = useStore.getState().jsonData;
      if (
        active.id &&
        (String(active.id_rpd_complect) === String(params.targetComplectId) ||
          active.complect_uuid === params.targetComplectId)
      )
        await prepareTemplateImport(active.id);
      requireSession(generation);
      return (
        await axiosBase.post<ImportComplectResponse>(
          "template-import/complect",
          params
        )
      ).data;
    },
    onSuccess: async (result) => {
      if (generation !== getSessionGeneration()) return;
      const { jsonData, setJsonData } = useStore.getState();
      if (
        result.imported.some(
          (entry) => entry.targetTemplateId === jsonData.id
        ) &&
        !useTemplateSync.getState().pending &&
        !Object.keys(useTemplateSync.getState().dirty).length
      ) {
        try {
          const { data } = await axiosBase.post<Record<string, unknown>>(
            "rpd-profile-templates",
            { id: jsonData.id }
          );
          if (
            generation === getSessionGeneration() &&
            useStore.getState().jsonData.id === jsonData.id &&
            !useTemplateSync.getState().pending &&
            !Object.keys(useTemplateSync.getState().dirty).length
          )
            setJsonData({
              ...jsonData,
              ...data,
              certification: data.certification || data.derived_certification,
            });
        } catch (error) {
          if (
            generation !== getSessionGeneration() ||
            error instanceof SessionChangedError
          )
            return;
          showErrorMessage(
            "Импорт завершён, но открытую РПД не удалось обновить. Перезагрузите её."
          );
        }
      }
      await Promise.all(
        [
          "rpd-complect",
          "my-templates",
          "template-history",
          "template-presence",
        ].map((key) => client.invalidateQueries({ queryKey: [key] }))
      );
    },
    retry: false,
  });
}
