import { QueryClient } from "@tanstack/react-query";
import {
  getSessionGeneration,
  subscribeToSessionGeneration,
} from "@shared/api";
import { useStore } from "@shared/hooks";
import { resetDiagnostics } from "@shared/diagnostics";
import { useTemplateSync } from "@entities/template";

let queryClient = new QueryClient();

export const getSessionQueryClient = () => queryClient;

// Слой app связывает границу сессии с состоянием нижних слоёв.
const unsubscribe = subscribeToSessionGeneration(() => {
  resetDiagnostics(getSessionGeneration());
  queryClient.clear();
  // Завершающиеся callbacks мутаций сохраняют ссылку только на старый клиент.
  queryClient = new QueryClient();
  useStore.setState(useStore.getInitialState(), true);
  useTemplateSync.getState().reset();
});

if (import.meta.hot) import.meta.hot.dispose(unsubscribe);
