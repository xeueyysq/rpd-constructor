import { pool } from "../../config/db.ts";
import RpdChangeableValues from "../models/rpd_changeable_values.ts";
import RpdProfileTemplates from "../models/rpd_profile_templates.ts";
import RpdComplects from "../models/rpd_complects.ts";
import { getContentRowHours, getStudyPlanHours, sumContentHours } from "../modules/disciplineScope.ts";
import { formatShortName } from "../modules/teacherNames.ts";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderTeacherBlocks(teachers: { fullname: string }[], caption: string): string {
  return (teachers.length ? teachers : [{ fullname: "" }]).map((teacher) => `
            <p style="margin:0;">${escapeHtml(formatShortName(teacher.fullname))}</p>
            <p style="margin:0;">________________________________________________________</p>
            <p style="${caption}"><i>Фамилия И.О., должность, ученая степень (при наличии),<br/>ученое звание (при наличии), кафедра</i></p>
            <p style="margin:20px 0 0 0;">_______________</p>
            <p style="${caption}"><i>подпись</i></p>`).join("");
}

// Общий инлайн-стилизованный HTML для PDF (puppeteer) и Word (@turbodocx/html-to-docx).
// Особенности конвертера html->docx (см. memory turbodocx-html-to-docx-quirks):
//  - <style>/классы игнорируются — только инлайн style;
//  - text-align работает на <p>/<h*>/ячейках таблиц, но НЕ на <div>;
//  - <br/> внутри <p> даёт перенос строки, внутри <div> — разрыв абзаца.
const PAGE_STYLE =
  "font-family:'Times', 'Times New Roman', serif; line-height:1.5;";
const CELL_STYLE = "border:1px solid black; padding:3px; vertical-align:top;";
const HEAD_CELL_STYLE = `${CELL_STYLE} font-weight:600; text-align:center;`;
const TABLE_STYLE =
  "width:100%; border-collapse:collapse; margin:20px 0; font-size:16px;";

function formatHours(value: number) {
  return String(value).replace(".", ",");
}

// Нормализуем кривые/закрывающие <br> к <br/>, который корректно понимают оба рендера.
function normalizeBr(value: unknown) {
  if (value == null) return "";
  return String(value).replace(/<\s*\/?\s*br\s*\/?\s*>/gi, "<br/>");
}

// @font-face нельзя задать инлайн, поэтому он остаётся в <head> — нужен только
// для PDF (puppeteer). html-to-docx этот блок игнорирует и берёт шрифт из опций.
function wrapHtml(bodyContent: string) {
  return `<!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8" />
        <title>РПД</title>
        <style>
            @font-face {
                font-family: 'Times';
                src: url('../fonts/times-new-roman-cyr-normal.ttf') format('truetype');
            }
            .content-page-content p { text-indent: 30px; }
        </style>
    </head>
    <body>${bodyContent}</body>
    </html>`;
}

async function generateCoverPage(id: unknown) {
  //data
  let uniName = null;
  let approvalField = null;
  let jsonData = null;
  let complectData = null;

  try {
    uniName = await new RpdChangeableValues(pool).getChangeableValue("uniName");
    approvalField = await new RpdChangeableValues(pool).getChangeableValue(
      "approvalField"
    );
    complectData = await new RpdComplects(pool).findRpdComplectData(id);
    jsonData = await new RpdProfileTemplates(pool).getJsonProfile(id);
  } catch (error) {
    console.log(error);
  }

  const center = "text-align:center; margin:0;";
  const subtitle = "text-align:center; font-size:16px; margin:20px 0 0 0;";
  const subtitleName = "font-size:18px;";

  const coverPageFragment = `
        <div class="page" style="${PAGE_STYLE}">
            <p style="${center} font-size:16px; font-weight:600;">${normalizeBr(
    uniName!.value
  )}</p>
            <p style="${center} font-size:16px; margin-top:20px;">${
    complectData!.faculty
  }<br/>${jsonData!.department}</p>
            <p style="text-align:right; font-size:16px; margin:60px 0;">${normalizeBr(
              approvalField!.value
            )}</p>
            <p style="${center} font-size:20px; margin-top:20px;"><b>Рабочая программа дисциплины</b></p>
            <p style="${center} font-size:20px; margin-top:20px;">${
    jsonData!.disciplins_name
  }</p>
            <p style="${subtitle}">Направление подготовки<br/><span style="${subtitleName}"><u>${
    jsonData!.direction
  }</u></span></p>
            <p style="${subtitle}">Уровень высшего образования<br/><span style="${subtitleName}"><u>${
    jsonData!.education_level
  }</u></span></p>
            <p style="${subtitle}">Направленность (профиль) программы<br/><span style="${subtitleName}"><u>${
    complectData!.profile
  }</u></span></p>
            <p style="${subtitle}">Форма(ы) обучения<br/><span style="${subtitleName}"><u>${
    complectData!.education_form
  }</u></span></p>
            <p style="${center} font-size:16px; margin-top:100px;">Дубна, ${
    complectData!.year
  }</p>
        </div>`;

  return coverPageFragment;
}

async function generateApprovalPage(id: unknown) {
  //data
  let jsonData = null;

  try {
    jsonData = await new RpdProfileTemplates(pool).getJsonProfile(id);
  } catch (error) {
    console.log(error);
  }

  const caption = "text-align:center; font-size:12px; margin:0;";
  const line = "margin:20px 0 0 0;";
  const teacherBlocks = renderTeacherBlocks(jsonData?.teachers ?? [], caption);

  const approvalPageFragment = `
        <div class="page" style="${PAGE_STYLE}">
            <p style="margin:0;">Преподаватель (преподаватели):</p>
            ${teacherBlocks}
            <p style="${line}">Рабочая программа разработана в соответствии с требованиями ФГОС ВО по направлению подготовки высшего образования</p>
            <p style="margin:20px 0 0 0;">${jsonData!.direction || ""}</p>
            <p style="margin:0;">______________________________________________________________________________</p>
            <p style="${caption}"><i>(код и наименование направления подготовки (специальности))</i></p>
            <p style="${line}">Программа рассмотрена на заседании кафедры</p>
            <p style="margin:0;">______________________________________________________________________________</p>
            <p style="${caption}"><i>(название кафедры)</i></p>
            <p style="${line}">Протокол заседания № _____ от «____» _______ 20___ г.</p>
            <p style="${line}">Заведующий кафедрой   _____________________</p>
            <p style="text-align:right; font-size:12px; margin:0;"><i>(Фамилия И.О., подпись)</i></p>
            <p style="margin:40px 0 0 0;">СОГЛАСОВАНО</p>
            <p style="${line}">Заведующий выпускающей кафедрой   _____________________</p>
            <p style="text-align:right; font-size:12px; margin:0;"><i>(Фамилия И.О., подпись)</i></p>
            <p style="${line}">«____» _______ 20___ г.</p>
            <p style="margin:40px 0 0 0;">Эксперт (рецензент):</p>
            <p style="margin:0;">______________________________________________________________________________</p>
            <p style="${caption}"><i>(Ф.И.О., ученая степень, ученое звание, место работы, должность; если текст рецензии не прикладывается –<br/>подпись эксперта (рецензента), заверенная по месту работы)</i></p>
        </div>`;

  return approvalPageFragment;
}

export function buildContentTableHtml(content: unknown, { forWord = false } = {}) {
  const rows = Array.isArray(content) ? content
    : content !== null && typeof content === "object" ? Object.values(content) : [];
  const contentTableRows = rows.map((row) => {
    const value = row !== null && typeof row === "object" && !Array.isArray(row)
      ? row as Record<string, unknown> : {};
    const hours = getContentRowHours(row);
    return `
              <tr>
                  <td style="${CELL_STYLE}">${value.theme || ""}</td>
                  <td style="${CELL_STYLE}">${formatHours(hours.total)}</td>
                  <td style="${CELL_STYLE}">${formatHours(hours.lectures)}</td>
                  <td style="${CELL_STYLE}">${formatHours(hours.seminars)}</td>
                  <td style="${CELL_STYLE}">${formatHours(hours.contact)}</td>
                  <td style="${CELL_STYLE}">${formatHours(hours.independent_work)}</td>
                  <td style="${CELL_STYLE}">${formatHours(hours.control)}</td>
              </tr>
          `;
  }).join("");
  const total = sumContentHours(content);

  // В Word после colspan вместо rowspan нужны обычные ячейки и заполнители.
  const independentHeader = forWord
    ? `<th style="${HEAD_CELL_STYLE}">Самостоятельная работа обучающегося</th>`
    : `<th style="${HEAD_CELL_STYLE}" rowspan="2">Самостоятельная работа обучающегося</th>`;
  const controlHeader = forWord
    ? `<th style="${HEAD_CELL_STYLE}">Контроль</th>`
    : `<th style="${HEAD_CELL_STYLE}" rowspan="2">Контроль</th>`;
  const headerFillers = forWord
    ? `<th style="${HEAD_CELL_STYLE}"></th><th style="${HEAD_CELL_STYLE}"></th>`
    : "";

  return `<table style="${TABLE_STYLE}">
                <tbody>
                    <tr>
                        <th style="${HEAD_CELL_STYLE}" rowspan="3">Наименование разделов и тем дисциплины</th>
                        <th style="${HEAD_CELL_STYLE}" rowspan="3">Всего(академ. часы)</th>
                        <th style="${HEAD_CELL_STYLE}" colspan="5">в том числе:</th>
                    </tr>
                    <tr>
                        <th style="${HEAD_CELL_STYLE}" colspan="3">Контактная работа (работа во взаимодействии с преподавателем)</th>
                        ${independentHeader}
                        ${controlHeader}
                    </tr>
                    <tr>
                        <th style="${HEAD_CELL_STYLE}">Лекции</th>
                        <th style="${HEAD_CELL_STYLE}">Практические (семинарские) занятия</th>
                        <th style="${HEAD_CELL_STYLE}"><b>Всего</b></th>
                        ${headerFillers}
                    </tr>
                    ${contentTableRows}
                    <tr>
                        <td style="${CELL_STYLE}"><b>Итого за семестр / курс</b></td>
                        <td style="${CELL_STYLE}"><b>${formatHours(total.total)}</b></td>
                        <td style="${CELL_STYLE}"><b>${formatHours(total.lectures)}</b></td>
                        <td style="${CELL_STYLE}"><b>${formatHours(total.seminars)}</b></td>
                        <td style="${CELL_STYLE}"><b>${formatHours(total.contact)}</b></td>
                        <td style="${CELL_STYLE}"><b>${formatHours(total.independent_work)}</b></td>
                        <td style="${CELL_STYLE}"><b>${formatHours(total.control)}</b></td>
                    </tr>
                </tbody>
            </table>`;
}

async function generateContentPage(id: unknown, { forWord = false } = {}) {
  //data
  let jsonData = null;
  let cource = null;

  try {
    jsonData = await new RpdProfileTemplates(pool).getJsonProfile(id);
    cource = Math.ceil(Number(jsonData?.semester || 1) / 2);
    console.log(jsonData);
  } catch (error) {
    console.log(error);
  }

  if (!jsonData) {
    return "";
  }

  const contentResult = sumContentHours(jsonData.content);
  const studyPlanHours = getStudyPlanHours(jsonData.study_load, jsonData.control_load);

  const competenciesContent = jsonData.competencies
    ? Object.keys(jsonData.competencies as Record<string, unknown>)
        .map((row) => {
          const value = (jsonData.competencies as Record<string, { results: string; competence?: string; indicator?: string }>)[row] || {};
          console.log(value);
          let results: unknown = value.results;
          try {
            results = JSON.parse(results as string);
          } catch {
            // Если не JSON, оставляем как строку
          }
          console.log(results);
          return `
              <tr>
                  <td style="${CELL_STYLE}">${value.competence || ""}</td>
                  <td style="${CELL_STYLE}">${value.indicator || ""}</td>
                  <td style="${CELL_STYLE}">
                  <u>Знать:</u><br/>${(results as Record<string, unknown>)["know"] || ""}<br/>
                  <u>Уметь:</u><br/>${(results as Record<string, unknown>)["beAble"] || ""}<br/>
                  <u>Владеть:</u><br/>${(results as Record<string, unknown>)["own"] || ""}
                  </td>
              </tr>
          `;
        })
        .join("")
    : "";

  const textbookList = Array.isArray(jsonData.textbook)
    ? jsonData.textbook.map((row: unknown) => `<li>${escapeHtml(String(row || ""))}</li>`).join("")
    : "";

  const additionalTextbookList = Array.isArray(jsonData.additional_textbook)
    ? jsonData.additional_textbook
        .map((row: unknown) => `<li>${escapeHtml(String(row || ""))}</li>`)
        .join("")
    : "";

  const titleStyle = "text-indent:20px; font-size:16px; margin:16px 0 0 0;";
  const contentStyle = "font-size:16px; text-align:justify;";
  const title = (text: string, extra = "") =>
    `<p style="${titleStyle} ${extra}"><b>${text}</b></p>`;

  const contentPageFragment = `
        <div class="page" style="${PAGE_STYLE}">
            ${title("1. Цели и задачи освоения дисциплины")}
            <div class="content-page-content" style="${contentStyle}">${
    jsonData.goals || ""
  }</div>
            ${title("2. Место дисциплины в структуре ОПОП")}
            <div class="content-page-content" style="${contentStyle}"><p style="text-indent:30px;">Дисциплина «${
    jsonData.disciplins_name || ""
  }» относится к ${jsonData.place || ""} учебного плана направления ${
    jsonData.direction || ""
  }.</p></div>
            <div class="content-page-content" style="${contentStyle}"><p style="text-indent:30px;">Дисциплина преподается в ${
    jsonData.semester || ""
  } семестре, на ${cource || ""} курсе.</p></div>
            <div class="content-page-content" style="${contentStyle}"><p style="text-indent:30px;">${
    jsonData.place_more_text || ""
  }</p></div>
            ${title("3. Планируемые результаты обучения по дисциплине (модулю)")}
            <table style="${TABLE_STYLE}">
                <thead>
                    <tr>
                        <th style="${HEAD_CELL_STYLE}">Формируемые компетенции<br/><i style="font-size:12px;">(код и наименование)</i></th>
                        <th style="${HEAD_CELL_STYLE}">Индикаторы достижения компетенций<br/><i style="font-size:12px;">(код и формулировка)</i></th>
                        <th style="${HEAD_CELL_STYLE}">Планируемые результаты обучения по дисциплине (модулю)</th>
                    </tr>
                </thead>
                <tbody>
                ${competenciesContent}
                </tbody>
            </table>
            ${title("4. Объем дисциплины")}
            <div class="content-page-content" style="${contentStyle}"><p style="text-indent:30px;">Объем дисциплины составляет ${
    jsonData.zet || ""
  } зачетных единиц, всего ${
    formatHours(studyPlanHours.has_total ? studyPlanHours.all : contentResult.total)
  } академических часов.</p></div>
            ${title("5. Содержание дисциплины")}
            ${buildContentTableHtml(jsonData.content, { forWord })}
            ${title("Содержание дисциплины")}
            <div class="content-page-content" style="${contentStyle}">${
    jsonData.content_more_text || ""
  }</div>
            <div class="content-page-content" style="${contentStyle}">${
    jsonData.content_template_more_text || ""
  }</div>
            ${title(
              "6. Перечень учебно-методического обеспечения по дисциплине",
              "padding-top:20px;"
            )}
            <div class="content-page-content" style="${contentStyle}">${
    jsonData.methodological_support_template || ""
  }</div>
            ${title("7. Фонды оценочных средств по дисциплине")}
            <div class="content-page-content" style="${contentStyle}">${
    jsonData.assessment_tools_template || ""
  }</div>
            ${title("8. Ресурсное обеспечение", "padding:20px 0;")}
            ${title("Перечень литературы")}
            ${title("Основная литература")}
            <div class="content-page-content" style="${contentStyle}">
                <ol>
                    ${textbookList}
                </ol>
            </div>
            ${title("Дополнительная литература")}
            <div class="content-page-content" style="${contentStyle}">
                <ol>
                    ${additionalTextbookList}
                </ol>
            </div>
            ${title(
              "Профессиональные базы данных и информационные справочные системы"
            )}
            <div class="content-page-content" style="${contentStyle}">${
    jsonData.professional_information_resources || ""
  }</div>
            ${title("Необходимое программное обеспечение", "padding-top:20px;")}
            <div class="content-page-content" style="${contentStyle}">${
    jsonData.software || ""
  }</div>
            ${title("Необходимое материально-техническое обеспечение")}
            <div class="content-page-content" style="${contentStyle}">${
    jsonData.logistics_template || ""
  }</div>
        </div>`;

  return contentPageFragment;
}

export {
  wrapHtml,
  normalizeBr,
  generateCoverPage,
  generateApprovalPage,
  generateContentPage,
};
