import JSZip from "jszip";

/** Синтетическая РПД: многострочная шапка, сокращения и отдельная колонка номера. */
export async function wordHoursDocument(numbered = true): Promise<Buffer> {
  const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const cell = (text: string, properties = "") => `<w:tc><w:tcPr>${properties}</w:tcPr>${paragraph(text)}</w:tc>`;
  const row = (cells: string[]) => `<w:tr>${cells.join("")}</w:tr>`;
  const merge = '<w:vMerge w:val="restart"/>';
  const continued = '<w:vMerge/>';
  const prefix = (header: boolean) => [
    ...(numbered ? [cell(header ? "№" : "", header ? merge : continued)] : []),
    cell(header ? "Наименование разделов и тем дисциплины" : "", header ? merge : continued),
    cell(header ? "Всего (академ. часы)" : "", header ? merge : continued),
  ];
  const headers = [
    row([...prefix(true), cell("в том числе:", '<w:gridSpan w:val="6"/>')]),
    row([...prefix(false), cell("Контактная работа (работа во взаимодействии с преподавателем)", '<w:gridSpan w:val="5"/>'), cell("Сам. раб.", merge)]),
    row([...prefix(false), ...["Лек.", "Пр.", "Лаб.", "К. р.", "Всего"].map((text) => cell(text)), cell("", continued)]),
  ];
  const totals = [15, 15, 15, 15, 14, 14, 13, 13, 13, 17];
  const topics = totals.map((total, index) => {
    const lectures = index < 6 ? 2 : 1;
    const practice = index < 4 ? 4 : 3;
    const independent = index === 3 ? 4 : 3;
    const title = index === 8 ? "Практические аспекты обучения: оценка ошибки" : `Тема ${index + 1}`;
    return row([...(numbered ? [cell(String(index + 1))] : []), cell(title),
      ...[total, lectures, practice, "", "", lectures + practice, independent].map((value) => cell(String(value)))]);
  });
  const summary = row([...(numbered ? [cell("")] : []), cell("Итого за семестр / курс:"),
    ...[108, 16, 34, "", "", 50, 31].map((value) => cell(String(value)))]);
  const exam = row([...(numbered ? [cell("")] : []), cell("Промежуточная аттестация: Экзамен"), cell("27"), cell("", '<w:gridSpan w:val="6"/>')]);
  const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[
    "Рабочая программа дисциплины", "Тестовый курс", "1. Цели и задачи освоения дисциплины",
    "Цель дисциплины — изучить методы анализа и их практическое применение.",
    "4. Объем дисциплины", "3 зач. ед., всего 108 академ. ч.", "5. Содержание дисциплины", "Очная форма обучения",
  ].map(paragraph).join("")}<w:tbl><w:tblGrid>${Array.from({ length: numbered ? 9 : 8 }, () => '<w:gridCol w:w="1000"/>').join("")}</w:tblGrid>${[...headers, ...topics, exam, summary].join("")}</w:tbl></w:body></w:document>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
