const { pool } = require("../../config/db");
const RpdChangeableValues = require("../models/rpd_changeable_values");
const RpdProfileTemplates = require("../models/rpd_profile_templates");
const RpdComplects = require("../models/rpd_complects");

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

// Нормализуем кривые/закрывающие <br> к <br/>, который корректно понимают оба рендера.
function normalizeBr(value) {
  if (value == null) return "";
  return String(value).replace(/<\s*\/?\s*br\s*\/?\s*>/gi, "<br/>");
}

// @font-face нельзя задать инлайн, поэтому он остаётся в <head> — нужен только
// для PDF (puppeteer). html-to-docx этот блок игнорирует и берёт шрифт из опций.
function wrapHtml(bodyContent) {
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

async function generateCoverPage(id) {
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
    uniName.value
  )}</p>
            <p style="${center} font-size:16px; margin-top:20px;">${
    complectData.faculty
  }<br/>${jsonData.department}</p>
            <p style="text-align:right; font-size:16px; margin:60px 0;">${normalizeBr(
              approvalField.value
            )}</p>
            <p style="${center} font-size:20px; margin-top:20px;"><b>Рабочая программа дисциплины</b></p>
            <p style="${center} font-size:20px; margin-top:20px;">${
    jsonData.disciplins_name
  }</p>
            <p style="${subtitle}">Направление подготовки<br/><span style="${subtitleName}"><u>${
    jsonData.direction
  }</u></span></p>
            <p style="${subtitle}">Уровень высшего образования<br/><span style="${subtitleName}"><u>${
    jsonData.education_level
  }</u></span></p>
            <p style="${subtitle}">Направленность (профиль) программы<br/><span style="${subtitleName}"><u>${
    complectData.profile
  }</u></span></p>
            <p style="${subtitle}">Форма(ы) обучения<br/><span style="${subtitleName}"><u>${
    complectData.education_form
  }</u></span></p>
            <p style="${center} font-size:16px; margin-top:100px;">Дубна, ${
    complectData.year
  }</p>
        </div>`;

  return coverPageFragment;
}

async function generateApprovalPage(id) {
  //data
  let jsonData = null;

  try {
    jsonData = await new RpdProfileTemplates(pool).getJsonProfile(id);
  } catch (error) {
    console.log(error);
  }

  const caption = "text-align:center; font-size:12px; margin:0;";
  const line = "margin:20px 0 0 0;";

  const approvalPageFragment = `
        <div class="page" style="${PAGE_STYLE}">
            <p style="margin:0;">Преподаватель (преподаватели):</p>
            <p style="margin:0;">${jsonData.teacher || ""}</p>
            <p style="margin:0;">________________________________________________________</p>
            <p style="${caption}"><i>Фамилия И.О., должность, ученая степень (при наличии),<br/>ученое звание (при наличии), кафедра</i></p>
            <p style="margin:20px 0 0 0;">_______________</p>
            <p style="${caption}"><i>подпись</i></p>
            <p style="${line}">Рабочая программа разработана в соответствии с требованиями ФГОС ВО по направлению подготовки высшего образования</p>
            <p style="margin:20px 0 0 0;">${jsonData.direction || ""}</p>
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

function contentResultFunc(data) {
  let summ = {
    result: 0,
    lectures: 0,
    seminars: 0,
    lect_and_sems: 0,
    independent_work: 0,
  };

  if (!data) {
    return summ;
  }

  Object.keys(data).forEach((value) => {
    const item = data[value] || {};
    const lectures = Number(item.lectures) || 0;
    const seminars = Number(item.seminars) || 0;
    const independentWork = Number(item.independent_work) || 0;

    summ.result += lectures + seminars + independentWork;
    summ.lectures += lectures;
    summ.seminars += seminars;
    summ.lect_and_sems += lectures + seminars;
    summ.independent_work += independentWork;
  });

  return summ;
}

async function generateContentPage(id, { forWord = false } = {}) {
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

  const contentResult = contentResultFunc(jsonData.content);

  const competenciesContent = jsonData.competencies
    ? Object.keys(jsonData.competencies)
        .map((row) => {
          const value = jsonData.competencies[row] || {};
          console.log(value);
          let results = value.results;
          try {
            results = JSON.parse(results);
          } catch (e) {
            // Если не JSON, оставляем как строку
          }
          console.log(results);
          return `
              <tr>
                  <td style="${CELL_STYLE}">${value.competence || ""}</td>
                  <td style="${CELL_STYLE}">${value.indicator || ""}</td>
                  <td style="${CELL_STYLE}">
                  <u>Знать:</u><br/>${results["know"] || ""}<br/>
                  <u>Уметь:</u><br/>${results["beAble"] || ""}<br/>
                  <u>Владеть:</u><br/>${results["own"] || ""}
                  </td>
              </tr>
          `;
        })
        .join("")
    : "";

  const contentTableRows = jsonData.content
    ? Object.keys(jsonData.content)
        .map((row) => {
          const value = jsonData.content[row] || {};
          const lectures = Number(value.lectures) || 0;
          const seminars = Number(value.seminars) || 0;
          const independentWork = Number(value.independent_work) || 0;
          return `
              <tr>
                  <td style="${CELL_STYLE}">${value.theme || ""}</td>
                  <td style="${CELL_STYLE}">${
            lectures + seminars + independentWork
          }</td>
                  <td style="${CELL_STYLE}">${lectures}</td>
                  <td style="${CELL_STYLE}">${seminars}</td>
                  <td style="${CELL_STYLE}">${lectures + seminars}</td>
                  <td style="${CELL_STYLE}">${independentWork}</td>
              </tr>
          `;
        })
        .join("")
    : "";

  // "Самостоятельная работа" в шапке таблицы объёма. В PDF — вертикальное
  // объединение (rowspan=2). html-to-docx ломает rowspan для колонок, идущих
  // после colspan, поэтому для Word используем обычную ячейку + пустую ячейку
  // снизу. См. memory turbodocx-html-to-docx-quirks.
  const independentHeaderRow1 = forWord
    ? `<th style="${HEAD_CELL_STYLE}">Самостоятельная работа обучающегося</th>`
    : `<th style="${HEAD_CELL_STYLE}" rowspan="2">Самостоятельная работа обучающегося</th>`;
  const independentHeaderFiller = forWord
    ? `<th style="${HEAD_CELL_STYLE}"></th>`
    : "";

  const textbookList = Array.isArray(jsonData.textbook)
    ? jsonData.textbook.map((row) => `<li>${row || ""}</li>`).join("")
    : "";

  const additionalTextbookList = Array.isArray(jsonData.additional_textbook)
    ? jsonData.additional_textbook
        .map((row) => `<li>${row || ""}</li>`)
        .join("")
    : "";

  const titleStyle = "text-indent:20px; font-size:16px; margin:16px 0 0 0;";
  const contentStyle = "font-size:16px; text-align:justify;";
  const title = (text, extra = "") =>
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
    jsonData.direction_of_study || ""
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
    contentResult.result
  } академических часов.</p></div>
            ${title("5. Содержание дисциплины")}
            <table style="${TABLE_STYLE}">
                <tbody>
                    <tr>
                        <th style="${HEAD_CELL_STYLE}" rowspan="3">Наименование разделов и тем дисциплины</th>
                        <th style="${HEAD_CELL_STYLE}" rowspan="3">Всего(академ. часы)</th>
                        <th style="${HEAD_CELL_STYLE}" colspan="4">в том числе:</th>
                    </tr>
                    <tr>
                        <th style="${HEAD_CELL_STYLE}" colspan="3">Контактная работа (работа во взаимодействии с преподавателем)</th>
                        ${independentHeaderRow1}
                    </tr>
                    <tr>
                        <th style="${HEAD_CELL_STYLE}">Лекции</th>
                        <th style="${HEAD_CELL_STYLE}">Практические (семинарские) занятия</th>
                        <th style="${HEAD_CELL_STYLE}"><b>Всего</b></th>
                        ${independentHeaderFiller}
                    </tr>
                    ${contentTableRows}
                    <tr>
                        <td style="${CELL_STYLE}"><b>Итого за семестр / курс</b></td>
                        <td style="${CELL_STYLE}"><b>${
    contentResult.result
  }</b></td>
                        <td style="${CELL_STYLE}"><b>${
    contentResult.lectures
  }</b></td>
                        <td style="${CELL_STYLE}"><b>${
    contentResult.seminars
  }</b></td>
                        <td style="${CELL_STYLE}"><b>${
    contentResult.lect_and_sems
  }</b></td>
                        <td style="${CELL_STYLE}"><b>${
    contentResult.independent_work
  }</b></td>
                    </tr>
                </tbody>
            </table>
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

module.exports = {
  wrapHtml,
  normalizeBr,
  generateCoverPage,
  generateApprovalPage,
  generateContentPage,
};
