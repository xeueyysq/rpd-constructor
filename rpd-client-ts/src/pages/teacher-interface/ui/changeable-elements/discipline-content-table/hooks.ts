import { useEffect, useMemo, useState } from "react";
import {
  DisciplineContentData,
  ObjectHours,
} from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import { ATTESTATION_ROW_ID } from "./types";
import {
  calculateMaxHours,
  getInitialTableData,
  getNextIdFromData,
  normalizeStudyLoad,
  sumControlLoadHours,
  sumTableHours,
  toNumberSafe,
} from "./utils";

export function useDisciplineContentMaxHours(
  studyLoad: unknown,
  controlLoad: unknown
) {
  const normalizedStudyLoad = useMemo(
    () => normalizeStudyLoad(studyLoad),
    [studyLoad]
  );
  const controlLoadHours = useMemo(
    () => sumControlLoadHours(controlLoad),
    [controlLoad]
  );

  return useMemo(
    () => calculateMaxHours(normalizedStudyLoad, controlLoadHours),
    [normalizedStudyLoad, controlLoadHours]
  );
}

type UseDisciplineContentDataParams = {
  tableData?: DisciplineContentData;
  storeData?: DisciplineContentData;
  templateId?: number;
};

export function useDisciplineContentData({
  tableData,
  storeData,
  templateId,
}: UseDisciplineContentDataParams) {
  const initialData = useMemo(
    () => getInitialTableData(tableData, storeData),
    [tableData, storeData]
  );

  const [nextId, setNextId] = useState<number>(() =>
    getNextIdFromData(initialData)
  );
  const [data, setData] = useState<DisciplineContentData>(initialData);

  useEffect(() => {
    setData(initialData);
    setNextId(getNextIdFromData(initialData));
  }, [initialData, templateId]);

  const rowIds = useMemo(() => {
    return [
      ...Object.keys(data).filter((id) => id !== ATTESTATION_ROW_ID),
      ATTESTATION_ROW_ID,
    ].filter((id) => Boolean(data[id]));
  }, [data]);

  const summ = useMemo(() => sumTableHours(data), [data]);

  return {
    data,
    setData,
    nextId,
    setNextId,
    rowIds,
    summ,
  };
}

export function useManualPlan(
  maxHours: ObjectHours,
  readOnly: boolean,
  templateId?: number
) {
  const manualPlanEnabled = !readOnly;
  const [manualPlan, setManualPlan] = useState<ObjectHours>(maxHours);
  const [manualPlanTouchedTotal, setManualPlanTouchedTotal] = useState(false);
  const [manualPlanTouchedBreakdown, setManualPlanTouchedBreakdown] =
    useState(false);

  useEffect(() => {
    if (!manualPlanEnabled) {
      setManualPlan(maxHours);
      setManualPlanTouchedTotal(false);
      setManualPlanTouchedBreakdown(false);
      return;
    }

    if (!manualPlanTouchedTotal && !manualPlanTouchedBreakdown) {
      setManualPlan(maxHours);
    }
  }, [
    manualPlanEnabled,
    maxHours,
    manualPlanTouchedTotal,
    manualPlanTouchedBreakdown,
  ]);

  useEffect(() => {
    setManualPlanTouchedTotal(false);
    setManualPlanTouchedBreakdown(false);
    setManualPlan(maxHours);
  }, [templateId, maxHours]);

  const manualPlanNumeric = useMemo(() => {
    const lectures = toNumberSafe(manualPlan.lectures);
    const seminars = toNumberSafe(manualPlan.seminars);
    const control = toNumberSafe(manualPlan.control);
    const independent = toNumberSafe(manualPlan.independent_work);
    const total = toNumberSafe(manualPlan.all);
    return {
      all: total,
      lectures,
      seminars,
      control,
      independent_work: independent,
      lect_and_sems: lectures + seminars + control,
    };
  }, [manualPlan]);

  const displayMaxHours = manualPlanEnabled ? manualPlanNumeric : maxHours;

  return {
    manualPlanEnabled,
    manualPlan,
    setManualPlan,
    manualPlanTouchedTotal,
    setManualPlanTouchedTotal,
    manualPlanTouchedBreakdown,
    setManualPlanTouchedBreakdown,
    manualPlanNumeric,
    displayMaxHours,
  };
}
