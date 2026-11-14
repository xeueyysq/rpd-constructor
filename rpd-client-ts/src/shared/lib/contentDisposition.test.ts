import { describe, expect, it } from "vitest";
import { filenameFromContentDisposition } from "./contentDisposition";

describe("filenameFromContentDisposition", () => {
  it("использует русское имя из filename*", () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename=\"rpd_2026.pdf\"; filename*=UTF-8''%D0%A4%D0%B8%D0%B7%D0%B8%D0%BA%D0%B0_01.03.02_2026.pdf",
        "РПД.pdf"
      )
    ).toBe("Физика_01.03.02_2026.pdf");
  });

  it("при повреждённом UTF-8 берёт ASCII-имя, затем запасное", () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename=\"rpd_2026.docx\"; filename*=UTF-8''%broken",
        "РПД.docx"
      )
    ).toBe("rpd_2026.docx");
    expect(filenameFromContentDisposition("attachment", "РПД.pdf")).toBe(
      "РПД.pdf"
    );
  });
});
