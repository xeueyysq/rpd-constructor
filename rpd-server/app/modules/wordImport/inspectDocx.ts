import yauzl, { type Entry, type ZipFile } from "yauzl";
import { PayloadTooLarge, Unprocessable } from "../../utils/Errors.ts";

export const MAX_DOCX_BYTES = 5 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 25 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 512;
const REQUIRED = ["[Content_Types].xml", "_rels/.rels", "word/document.xml"] as const;

function unsafePath(name: string): boolean {
  return !name || name.startsWith("/") || name.includes("\\") || name.includes("\0")
    || name.split("/").some((part) => part === ".." || part === "." || part.includes(":"));
}

/** Stream every member before JSZip/Mammoth see the archive. yauzl checks entry
 * sizes against actual output; our counters stop a stream that exceeds the caps. */
export async function inspectDocx(buffer: Buffer): Promise<void> {
  if (!buffer.length) throw new Unprocessable("Пустой DOCX");
  if (buffer.length > MAX_DOCX_BYTES) throw new PayloadTooLarge("DOCX должен быть не больше 5 МБ");
  if (buffer.subarray(0, 4).toString("binary") !== "PK\x03\x04") throw new Unprocessable("Файл не является DOCX");
  const zip = await new Promise<ZipFile>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, decodeStrings: true }, (error, opened) => {
      if (error || !opened) reject(new Unprocessable("Повреждённый DOCX"));
      else resolve(opened);
    });
  });
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    let total = 0;
    let entries = 0;
    const names = new Set<string>();
    const parts = new Map<string, string>();
    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      zip.close();
      reject(error instanceof PayloadTooLarge || error instanceof Unprocessable ? error : new Unprocessable("Повреждённый DOCX"));
    };
    zip.on("error", fail);
    zip.on("end", () => {
      if (finished) return;
      try {
        if (REQUIRED.some((name) => !names.has(name))) throw new Unprocessable("В DOCX отсутствуют обязательные части Office Open XML");
        if (!parts.get("[Content_Types].xml")?.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"))
          throw new Unprocessable("Файл не является документом Word DOCX");
        if (!parts.get("_rels/.rels")?.includes("officeDocument")) throw new Unprocessable("В DOCX отсутствует связь с документом");
        finished = true;
        resolve();
      } catch (error) { fail(error); }
    });
    zip.on("entry", (entry: Entry) => {
      if (finished) return;
      const name = entry.fileName;
      if (++entries > MAX_ENTRIES) return fail(new PayloadTooLarge("В DOCX слишком много частей"));
      if (unsafePath(name) || names.has(name) || (entry.generalPurposeBitFlag & 1) !== 0)
        return fail(new Unprocessable("Недопустимая часть DOCX"));
      names.add(name);
      if (entry.uncompressedSize > MAX_ENTRY_BYTES || total + entry.uncompressedSize > MAX_UNPACKED_BYTES)
        return fail(new PayloadTooLarge("Распакованный DOCX слишком велик"));
      if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8)
        return fail(new Unprocessable("Неподдерживаемое сжатие DOCX"));
      zip.openReadStream(entry, (error, stream) => {
        if (error || !stream) return fail(error);
        let size = 0;
        const xml = name.endsWith(".xml") || name.endsWith(".rels");
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          total += chunk.length;
          if (size > MAX_ENTRY_BYTES || total > MAX_UNPACKED_BYTES) {
            stream.destroy();
            fail(new PayloadTooLarge("Распакованный DOCX слишком велик"));
            return;
          }
          if (xml) chunks.push(chunk);
        });
        stream.on("error", fail);
        stream.on("end", () => {
          if (finished) return;
          if (size !== entry.uncompressedSize) return fail(new Unprocessable("Повреждённый DOCX"));
          if (xml) {
            const value = Buffer.concat(chunks).toString("utf8");
            // External hyperlink relationships remain inert text: the parser reads
            // only members in this ZIP and never resolves relationship targets.
            if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(value))
              return fail(new Unprocessable("В DOCX обнаружены сущности XML"));
            if (REQUIRED.includes(name as typeof REQUIRED[number])) parts.set(name, value);
          }
          zip.readEntry();
        });
      });
    });
    zip.readEntry();
  });
}
