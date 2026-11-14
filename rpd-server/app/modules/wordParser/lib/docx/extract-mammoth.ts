import mammoth from "mammoth";

export async function extractMammothRawText(
  data: ArrayBuffer,
): Promise<{ value: string; error?: string }> {
  try {
    const res = await mammoth.extractRawText({ arrayBuffer: data });
    return { value: res.value };
  } catch (e) {
    return { value: "", error: e instanceof Error ? e.message : "mammoth" };
  }
}
