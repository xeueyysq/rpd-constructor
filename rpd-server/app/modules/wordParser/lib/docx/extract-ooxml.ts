import JSZip from "jszip";

const DOC_PATH = "word/document.xml";

export async function getDocumentXmlFromDocx(
  data: ArrayBuffer,
): Promise<{ xml: string; error?: string }> {
  try {
    const zip = await JSZip.loadAsync(data);
    const f = zip.file(DOC_PATH);
    if (!f) {
      return { xml: "", error: "document.xml" };
    }
    const xml = await f.async("string");
    return { xml };
  } catch {
    return { xml: "", error: "read" };
  }
}

export { DOC_PATH };
