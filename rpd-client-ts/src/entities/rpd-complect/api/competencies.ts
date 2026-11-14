import {
  axiosBase,
  getSessionGeneration,
  SessionChangedError,
} from "@shared/api";
import type { ComplectCompetency } from "../model/competencies";

export async function getComplectCompetencies(
  complectId: number | string,
  signal?: AbortSignal
) {
  const { data } = await axiosBase.get<ComplectCompetency[]>(
    "get-results-data",
    {
      params: { complectId },
      signal,
    }
  );
  return data;
}

export async function setComplectCompetencies({
  complectId,
  data,
  generation,
}: {
  complectId: number | string;
  data: ComplectCompetency[];
  generation: number;
}) {
  if (generation !== getSessionGeneration()) throw new SessionChangedError();
  await axiosBase.post("set-results-data", { complectId, data });
}
