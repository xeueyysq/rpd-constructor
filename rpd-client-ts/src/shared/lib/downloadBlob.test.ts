import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./downloadBlob";

afterEach(() => vi.unstubAllGlobals());

describe("downloadBlob", () => {
  it("скачивает Blob с заданным именем и освобождает URL", () => {
    const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    const appendChild = vi.fn();
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: { appendChild },
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const blob = new Blob(["содержимое"]);
    downloadBlob(blob, "ФОС.xlsx");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(link).toMatchObject({ href: "blob:test", download: "ФОС.xlsx" });
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
