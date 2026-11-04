import { beforeEach, expect, it, vi } from "vitest";
import { axiosBase } from "@shared/api";
import { fetchComplectRpd } from "./api";
import type { ComplectRpdDto } from "../types";

vi.mock("@shared/api", () => ({ axiosBase: { post: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

it("find-rpd преобразует метаданные строки БД в контекст целевого комплекта", async () => {
  const dto: ComplectRpdDto = {
    id: 313,
    uuid: "target-complect",
    faculty: "Институт цели List3",
    direction: "Направление List3",
    profile: "List3 Массовый импорт",
    year: 2026,
    education_form: "Очная",
    education_level: "Бакалавриат",
    last_synced_at: "2026-11-04T10:00:00Z",
    has_pending_changes: true,
    templates: [],
  };
  vi.mocked(axiosBase.post).mockResolvedValue({ data: dto });

  const meta = await fetchComplectRpd(dto.uuid);

  expect(
    `${meta.directionOfStudy} • ${meta.profile} • ${meta.year} • ${meta.formEducation}`
  ).toBe("Направление List3 • List3 Массовый импорт • 2026 • Очная");
  expect(meta).toMatchObject({
    levelEducation: "Бакалавриат",
    lastSyncedAt: "2026-11-04T10:00:00Z",
    hasPendingChanges: true,
    templates: [],
  });
});
