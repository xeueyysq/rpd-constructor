import { afterEach, expect, it } from "vitest";
import {
  axiosAuth,
  beginSession,
  endSession,
  refreshSession,
} from "@shared/api";
import { useStore } from "@shared/hooks";
import { useTemplateSync } from "@entities/template";
import { getSessionQueryClient } from "./sessionState";

const adapter = axiosAuth.defaults.adapter;
afterEach(() => {
  endSession();
  axiosAuth.defaults.adapter = adapter;
});

it("смена поколения очищает пользовательское состояние; refresh сохраняет новое состояние", async () => {
  beginSession();
  const oldClient = getSessionQueryClient();
  oldClient.setQueryData(["rpd-complect", "same-id"], { owner: "A" });
  oldClient.getMutationCache().build(oldClient, { mutationKey: ["A"] });
  useStore.getState().setJsonData({ id: 12, goals: "A" });
  useStore.getState().setComplectId(100);
  useStore.getState().setSelectedTemplateData("A", "A", "A", "A", "A", "2026");
  useTemplateSync.getState().markDirty("goals");
  let finish!: () => void;
  const saving = useTemplateSync.getState().track(
    new Promise<void>((resolve) => {
      finish = resolve;
    })
  );

  beginSession();
  const client = getSessionQueryClient();
  expect(client).not.toBe(oldClient);
  expect(oldClient.getQueryCache().getAll()).toEqual([]);
  expect(oldClient.getMutationCache().getAll()).toEqual([]);
  expect(useStore.getState()).toMatchObject({
    jsonData: {},
    complectId: undefined,
  });
  expect(useStore.getState().selectedTemplateData.profile).toBeUndefined();
  expect(useTemplateSync.getState()).toMatchObject({
    dirty: {},
    pending: 0,
    savedAt: null,
  });
  // Мутация, прошедшая транспорт до logout, всё ещё держит старую ссылку.
  oldClient.setQueryData(["rpd-complect", "same-id"], { owner: "late-A" });
  expect(client.getQueryData(["rpd-complect", "same-id"])).toBeUndefined();
  finish();
  await saving;
  expect(useTemplateSync.getState().savedAt).toBeNull();
  oldClient.clear();

  client.setQueryData(["rpd-complect", "same-id"], { owner: "B" });
  useStore.getState().setJsonData({ id: 12, goals: "B" });
  useTemplateSync.getState().markDirty("goals");
  axiosAuth.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: "OK",
    headers: {},
    data: {
      accessToken: "B",
      accessTokenExpiration: 10000,
      role: 3,
      fullname: { name: "B", surname: "", patronymic: "" },
    },
  });
  await refreshSession();
  expect(getSessionQueryClient()).toBe(client);
  expect(client.getQueryData(["rpd-complect", "same-id"])).toEqual({
    owner: "B",
  });
  expect(useStore.getState().jsonData.goals).toBe("B");
  expect(useTemplateSync.getState().dirty.goals).toBeDefined();
});
