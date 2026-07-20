import { useEffect, useState } from "react";
import { VariantType, enqueueSnackbar } from "notistack";
import { fetchSpecProfiles } from "../api/fetchSpecProfiles";
import { SpecProfilesSource, SpecProfilesTree } from "./types";

const SOURCE_MESSAGES: Partial<Record<SpecProfilesSource, string>> = {
  database: "Профили загружены из кэша",
  fallback: "Используется резервный список профилей",
};

export const useSpecProfiles = () => {
  const [tree, setTree] = useState<SpecProfilesTree | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const loadProfiles = async () => {
      try {
        const { tree: loadedTree, source } = await fetchSpecProfiles();

        if (isCancelled) {
          return;
        }

        setTree(loadedTree);

        const message = SOURCE_MESSAGES[source];
        if (message) {
          const variant: VariantType = "warning";
          enqueueSnackbar(message, { variant });
        }
      } catch {
        if (!isCancelled) {
          const variant: VariantType = "error";
          enqueueSnackbar("Ошибка загрузки профилей", { variant });
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadProfiles();

    return () => {
      isCancelled = true;
    };
  }, []);

  return { tree, isLoading };
};
