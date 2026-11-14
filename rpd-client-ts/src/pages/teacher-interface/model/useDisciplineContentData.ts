import { useEffect, useRef, useState } from "react";
import {
  sameValue,
  useTemplateSync,
  useUpdateTemplateField,
  type FieldEdits,
} from "@entities/template";
import {
  getSessionGeneration,
  subscribeToSessionGeneration,
  SessionChangedError,
} from "@shared/api";
import { useStore } from "@shared/hooks";
import { useContentSnapshot } from "../api/contentSnapshot";
import { saveStudyPlan } from "../api/studyPlan";
import {
  changedPlanHours,
  contentForDisplay,
  contentForSave,
  emptyPlan,
  validContentDraft,
  type EditablePlanHour,
} from "../lib/contentDraft";
import { normalizeContent } from "../lib/normalizeContent";
import type {
  DisciplineContentData,
  StudyPlanHours,
} from "./DisciplineContentPageTypes";
import type { EditableRowKey } from "../ui/changeable-elements/discipline-content-table/types";

type EditSession = {
  templateId: number;
  generation: number;
  baseAt: string | null;
  baseline: DisciplineContentData;
  initialDisplay: DisciplineContentData;
  draft: DisciplineContentData;
  planBaseline: StudyPlanHours;
  planDraft: StudyPlanHours;
  attestationTheme: string;
  touched: Partial<Record<EditablePlanHour, true>>;
  dirtyBefore: Record<string, number>;
  ownedDirty: Record<string, number>;
  contentSaved: boolean;
};

function clearOwnedDirty(session: EditSession) {
  if (
    getSessionGeneration() !== session.generation ||
    useStore.getState().jsonData.id !== session.templateId
  )
    return;
  for (const [field, revision] of Object.entries(session.ownedDirty)) {
    if (revision !== session.dirtyBefore[field])
      useTemplateSync.getState().clearDirty(field, revision);
  }
}

export function useDisciplineContentData({
  tableData,
  enabled,
  canEditPlan,
}: {
  tableData?: DisciplineContentData;
  enabled: boolean;
  canEditPlan: boolean;
}) {
  const jsonData = useStore((state) => state.jsonData);
  const saveField = useUpdateTemplateField();
  const snapshot = useContentSnapshot();
  const [session, setSession] = useState<EditSession | null>(null);
  const active = useRef<EditSession | null>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan =
    (jsonData.study_plan_hours as StudyPlanHours | undefined) ?? emptyPlan;
  const attestationTheme = `Промежуточная аттестация: ${jsonData.certification ? String(jsonData.certification).toLowerCase() : "не выбрано"}`;
  const current = (candidate: EditSession) =>
    active.current === candidate &&
    candidate.generation === getSessionGeneration() &&
    useStore.getState().jsonData.id === candidate.templateId;

  useEffect(() => {
    const invalidate = () => {
      if (active.current) clearOwnedDirty(active.current);
      active.current = null;
      busy.current = false;
      setSession(null);
      setSaving(false);
      setError(null);
    };
    invalidate();
    return subscribeToSessionGeneration(invalidate);
  }, [jsonData.id, enabled, canEditPlan]);

  useEffect(
    () => () => {
      if (active.current) clearOwnedDirty(active.current);
      active.current = null;
    },
    []
  );

  const editing = Boolean(
    enabled &&
    session &&
    session.templateId === jsonData.id &&
    session.generation === getSessionGeneration()
  );
  const data =
    editing && session
      ? session.draft
      : contentForDisplay(
          tableData ?? jsonData.content,
          attestationTheme,
          plan.control
        );

  const edit = () => {
    const store = useStore.getState().jsonData;
    const dirtyBefore = { ...useTemplateSync.getState().dirty };
    if (
      !enabled ||
      !store.id ||
      busy.current ||
      dirtyBefore.content ||
      dirtyBefore.study_load
    )
      return;
    const draft = contentForDisplay(
      store.content,
      attestationTheme,
      plan.control
    );
    const next: EditSession = {
      templateId: store.id,
      generation: getSessionGeneration(),
      baseAt:
        (store.field_edits as FieldEdits | undefined)?.content?.at ?? null,
      baseline: normalizeContent(store.content),
      initialDisplay: draft,
      draft,
      planBaseline: { ...plan },
      planDraft: { ...plan },
      attestationTheme,
      touched: {},
      dirtyBefore,
      ownedDirty: {
        content: useTemplateSync.getState().markDirty("content"),
        ...(canEditPlan
          ? { study_load: useTemplateSync.getState().markDirty("study_load") }
          : {}),
      },
      contentSaved: false,
    };
    active.current = next;
    setSession(next);
    setError(null);
  };

  const changeRow = (
    rowId: string,
    key: EditableRowKey,
    value: string | number | null
  ) => {
    const next = active.current;
    if (!next || !current(next) || busy.current || !enabled) return;
    next.draft = {
      ...next.draft,
      [rowId]: { ...next.draft[rowId], [key]: value },
    };
    setSession({ ...next });
  };
  const addRow = () => {
    const next = active.current;
    if (!next || !current(next) || busy.current || !enabled) return;
    const ids = Object.keys(next.draft).map(Number).filter(Number.isFinite);
    const id = String(ids.length ? Math.max(...ids) + 1 : 0);
    next.draft = {
      ...next.draft,
      [id]: {
        theme: "",
        lectures: null,
        seminars: null,
        control: null,
        independent_work: null,
        competence: "",
        indicator: "",
        results: "",
      },
    };
    setSession({ ...next });
  };
  const changePlan = (key: EditablePlanHour, value: number) => {
    const next = active.current;
    if (!next || !current(next) || busy.current || !enabled || !canEditPlan)
      return;
    next.planDraft = { ...next.planDraft, [key]: value };
    next.planDraft.contact = next.planDraft.lectures + next.planDraft.seminars;
    next.touched = { ...next.touched, [key]: true };
    setSession({ ...next });
  };

  const save = async () => {
    const next = active.current;
    if (!next || !current(next) || !enabled || busy.current) return;
    const content = contentForSave(
      next.draft,
      next.initialDisplay,
      next.baseline
    );
    const hours = canEditPlan
      ? changedPlanHours(next.planDraft, next.planBaseline)
      : {};
    if (!validContentDraft(content, hours)) {
      setError("Часы должны быть конечными неотрицательными числами.");
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      if (!sameValue(content, next.baseline)) {
        const request = saveField("content", content, {
          keepDraftOnConflict: true,
          baseAt: next.baseAt,
        });
        next.ownedDirty.content = useTemplateSync.getState().dirty.content;
        const saved = await request;
        if (!current(next)) return;
        if (!saved) {
          setError("Содержание не сохранено. Черновик оставлен в редакторе.");
          return;
        }
        next.baseline = content;
        next.initialDisplay = next.draft;
        next.baseAt =
          (useStore.getState().jsonData.field_edits as FieldEdits | undefined)
            ?.content?.at ?? null;
        next.contentSaved = true;
        // Защищаем активный черновик от presence до завершения всей операции.
        next.ownedDirty.content = useTemplateSync
          .getState()
          .markDirty("content");
      }
      if (Object.keys(hours).length) {
        if (!current(next)) return;
        const updated = await useTemplateSync
          .getState()
          .track(saveStudyPlan(next.templateId, { hours }));
        if (!current(next)) return;
        const { updateJsonData } = useStore.getState();
        updateJsonData("study_load", updated.study_load);
        updateJsonData("zet", updated.zet);
        updateJsonData("study_plan_hours", updated.study_plan_hours);
        updateJsonData("field_edits", {
          ...(useStore.getState().jsonData.field_edits as
            FieldEdits | undefined),
          ...updated.edits,
        });
        next.planBaseline = { ...updated.study_plan_hours };
      }
      if (!current(next)) return;
      clearOwnedDirty(next);
      active.current = null;
      setSession(null);
    } catch (cause) {
      if (!current(next) || cause instanceof SessionChangedError) return;
      setError(
        next.contentSaved
          ? "Содержание сохранено, часы учебного плана не сохранены. Повторите сохранение или отмените оставшиеся изменения."
          : "Часы учебного плана не сохранены. Черновик оставлен в редакторе."
      );
    } finally {
      if (active.current === next || active.current === null) {
        busy.current = false;
        setSaving(false);
      }
    }
  };

  const cancel = async () => {
    const next = active.current;
    if (!next || !current(next) || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const latest = await snapshot.mutateAsync(next.templateId);
      if (!current(next)) return;
      const { updateJsonData } = useStore.getState();
      const sync = useTemplateSync.getState();
      const edits = {
        ...(useStore.getState().jsonData.field_edits as FieldEdits | undefined),
      };
      for (const field of ["content", "study_load"] as const) {
        if (sync.dirty[field] && sync.dirty[field] !== next.ownedDirty[field])
          continue;
        updateJsonData(field, latest[field]);
        if (latest.field_edits?.[field])
          edits[field] = latest.field_edits[field];
        else delete edits[field];
        if (field === "study_load" && !sync.dirty.study_plan_hours)
          updateJsonData("study_plan_hours", latest.study_plan_hours);
      }
      updateJsonData("field_edits", edits);
      clearOwnedDirty(next);
      active.current = null;
      setSession(null);
    } catch (cause) {
      if (current(next) && !(cause instanceof SessionChangedError))
        setError(
          "Не удалось загрузить актуальные данные. Черновик оставлен; повторите отмену."
        );
    } finally {
      if (active.current === next || active.current === null) {
        busy.current = false;
        setSaving(false);
      }
    }
  };

  return {
    data,
    editing,
    saving,
    error,
    displayedPlan: editing && session ? session.planDraft : plan,
    touched: editing && session ? session.touched : {},
    attestationTheme:
      editing && session ? session.attestationTheme : attestationTheme,
    edit,
    save,
    cancel,
    changeRow,
    addRow,
    changePlan,
  };
}
