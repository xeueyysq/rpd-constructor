import { QueryClient } from "@tanstack/react-query";
import { subscribeToSessionGeneration } from "@shared/api";
import { useStore } from "@shared/hooks";
import { useTemplateSync } from "@entities/template";

let queryClient = new QueryClient();

export const getSessionQueryClient = () => queryClient;

// Слой app связывает границу сессии с состоянием нижних слоёв.
const unsubscribe = subscribeToSessionGeneration(() => {
  queryClient.clear();
  // Завершающиеся callbacks мутаций сохраняют ссылку только на старый клиент.
  queryClient = new QueryClient();
  useStore.setState(useStore.getInitialState(), true);
  useTemplateSync.getState().reset();
});

if (import.meta.hot) import.meta.hot.dispose(unsubscribe);
