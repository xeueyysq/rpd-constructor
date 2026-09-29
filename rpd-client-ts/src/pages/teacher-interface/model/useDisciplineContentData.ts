import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DisciplineContentData,
  StudyPlanHours,
} from "./DisciplineContentPageTypes";
import { sumContentHours } from "../lib/hours";
import { useTemplateSync } from "@entities/template";

export const ATTESTATION_ROW_ID = "__attestation__";

export function useDisciplineContentData(
  tableData: DisciplineContentData | undefined,
  storeData: DisciplineContentData | undefined,
  templateId: number | undefined
) {
  const initialData = useMemo(
    () =>
      tableData ??
      storeData ?? {
        "0": {
          theme: "",
          lectures: 0,
          seminars: 0,
          independent_work: 0,
          competence: "",
          indicator: "",
          results: "",
        },
      },
    [tableData, storeData]
  );
  const [data, setData] = useState<DisciplineContentData>(initialData);
  const [nextId, setNextId] = useState(() => getNextId(initialData));
  const dirty = useTemplateSync((state) => Boolean(state.dirty.content));
  const templateIdRef = useRef(templateId);
  useEffect(() => {
    const templateChanged = templateIdRef.current !== templateId;
    templateIdRef.current = templateId;
    if (dirty && !templateChanged) return;
    setData(initialData);
    setNextId(getNextId(initialData));
  }, [initialData, templateId, dirty]);
  const rowIds = useMemo(
    () =>
      [
        ...Object.keys(data).filter((id) => id !== ATTESTATION_ROW_ID),
        ATTESTATION_ROW_ID,
      ].filter((id) => Boolean(data[id])),
    [data]
  );
  return {
    data,
    setData,
    nextId,
    setNextId,
    rowIds,
    summ: useMemo(() => sumContentHours(data), [data]),
  };
}

function getNextId(data: DisciplineContentData) {
  const ids = Object.keys(data).map(Number).filter(Number.isFinite);
  return ids.length ? Math.max(...ids) + 1 : 0;
}

type EditableHour =
  "all" | "lectures" | "seminars" | "control" | "independent_work";
export function useManualPlan(
  plan: StudyPlanHours,
  templateId: number | undefined
) {
  const [values, setValues] = useState(plan);
  const [touched, setTouched] = useState<Partial<Record<EditableHour, true>>>(
    {}
  );
  const valuesRef = useRef(plan);
  const touchedRef = useRef(touched);
  const templateIdRef = useRef(templateId);
  useEffect(() => {
    if (templateIdRef.current !== templateId) {
      templateIdRef.current = templateId;
      touchedRef.current = {};
      setTouched({});
    }
    const next = { ...plan };
    for (const key of Object.keys(touchedRef.current) as EditableHour[])
      next[key] = valuesRef.current[key];
    next.contact = next.lectures + next.seminars;
    valuesRef.current = next;
    setValues(next);
  }, [plan, templateId]);
  const change = (key: EditableHour, value: number) => {
    const previous = valuesRef.current;
    const next = {
      ...previous,
      [key]: value,
      contact:
        key === "lectures"
          ? value + previous.seminars
          : key === "seminars"
            ? previous.lectures + value
            : previous.contact,
    };
    valuesRef.current = next;
    setValues(next);
    touchedRef.current = { ...touchedRef.current, [key]: true };
    setTouched(touchedRef.current);
  };
  const settle = (key: EditableHour, value: number) => {
    if (valuesRef.current[key] !== value) return false;
    const next = { ...touchedRef.current };
    delete next[key];
    touchedRef.current = next;
    setTouched(next);
    return Object.keys(next).length === 0;
  };
  return { values, touched, change, settle };
}
