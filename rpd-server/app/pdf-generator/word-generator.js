const HTMLtoDOCX = require("@turbodocx/html-to-docx");
const JSZip = require("jszip");
const {
  wrapHtml,
  generateCoverPage,
  generateApprovalPage,
  generateContentPage,
} = require("./page-generator");

// Разрыв страницы, который понимает и puppeteer, и html-to-docx.
const PAGE_BREAK = '<div style="page-break-after: always;"></div>';

// Размеры в твипах (1 мм = 56.6929 твипа). Совпадают с настройками PDF:
// A4, поля top/bottom 20мм, left 30мм, right 10мм.
const MM = 56.6929;
const A4 = { width: 11906, height: 16838 };
const MARGINS = {
  top: Math.round(20 * MM), // 1134
  bottom: Math.round(20 * MM), // 1134
  left: Math.round(30 * MM), // 1701
  right: Math.round(10 * MM), // 567
};

// html-to-docx выставляет невалидный w:gridSpan="0" на объединённых по вертикали
// ячейках (vMerge continue), из-за чего Word схлопывает колонку в ноль ширины.
// Удаляем такие атрибуты прямо в document.xml. См. memory turbodocx-html-to-docx-quirks.
async function stripInvalidGridSpan(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) return buffer;

  const xml = await docFile.async("string");
  const fixed = xml.replace(/<w:gridSpan\s+w:val="0"\s*\/>/g, "");
  if (fixed === xml) return buffer;

  zip.file("word/document.xml", fixed);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function generateWord(id) {
  const htmlCoverPage = await generateCoverPage(id);
  const htmlApprovalPage = await generateApprovalPage(id);
  const htmlContentPage = await generateContentPage(id, { forWord: true });

  const body = [htmlCoverPage, htmlApprovalPage, htmlContentPage].join(
    PAGE_BREAK
  );
  const fullHtml = wrapHtml(body);

  const result = await HTMLtoDOCX(fullHtml, null, {
    orientation: "portrait",
    pageSize: A4,
    margins: MARGINS,
    font: "Times New Roman",
    fontSize: 24, // half-points = 12pt базовый размер
    title: "Рабочая программа дисциплины",
    table: {
      row: { cantSplit: true },
      borderOptions: { size: 2, color: "000000" },
    },
  });

  // В Node html-to-docx может вернуть Buffer или ArrayBuffer — нормализуем.
  const buffer = Buffer.isBuffer(result) ? result : Buffer.from(result);
  return stripInvalidGridSpan(buffer);
}

module.exports = generateWord;
