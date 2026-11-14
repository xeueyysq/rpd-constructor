import { useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSessionGeneration,
  subscribeToSessionGeneration,
  SessionChangedError,
} from "@shared/api";
import {
  getComplectCompetencies,
  setComplectCompetencies,
} from "../api/competencies";

const keyFor = (id: number | string, generation: number) =>
  ["complect-competencies", String(id), generation] as const;

export function useComplectCompetencies(
  complectId: number | string,
  enabled = true
) {
  const generation = useSyncExternalStore(
    subscribeToSessionGeneration,
    getSessionGeneration
  );
  return useQuery({
    queryKey: keyFor(complectId, generation),
    queryFn: ({ signal }) => {
      if (generation !== getSessionGeneration())
        throw new SessionChangedError();
      return getComplectCompetencies(complectId, signal);
    },
    enabled,
    refetchOnMount: "always",
  });
}

export function useUploadComplectCompetencies() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Parameters<typeof setComplectCompetencies>[0]
    ) => {
      await setComplectCompetencies(input);
      if (input.generation !== getSessionGeneration())
        throw new SessionChangedError();
      const queryKey = keyFor(input.complectId, input.generation);
      await client.cancelQueries({ queryKey });
      return client.fetchQuery({
        queryKey,
        queryFn: ({ signal }) => {
          if (input.generation !== getSessionGeneration())
            throw new SessionChangedError();
          return getComplectCompetencies(input.complectId, signal);
        },
        staleTime: 0,
      });
    },
  });
}
