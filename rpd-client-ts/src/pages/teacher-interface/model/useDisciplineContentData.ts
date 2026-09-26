import { useEffect, useMemo, useState } from "react";
import type {
  DisciplineContentData,
  StudyPlanHours,
} from "./DisciplineContentPageTypes";
import { sumContentHours } from "../lib/hours";

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
  useEffect(() => {
    setData(initialData);
    setNextId(getNextId(initialData));
  }, [initialData, templateId]);
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
  useEffect(() => {
    setValues(plan);
    setTouched({});
  }, [plan, templateId]);
  const change = (key: EditableHour, value: number) => {
    setValues((previous) => ({
      ...previous,
      [key]: value,
      contact:
        key === "lectures"
          ? value + previous.seminars
          : key === "seminars"
            ? previous.lectures + value
            : previous.contact,
    }));
    setTouched((previous) => ({ ...previous, [key]: true }));
  };
  const patch = Object.fromEntries(
    (Object.keys(touched) as EditableHour[]).map((key) => [key, values[key]])
  ) as Partial<Pick<StudyPlanHours, EditableHour>>;
  return { values, touched, change, patch, reset: () => setTouched({}) };
}
