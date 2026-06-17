const puppeteer = require("puppeteer");
const {
  wrapHtml,
  generateCoverPage,
  generateApprovalPage,
  generateContentPage,
} = require("./page-generator");

const PAGE_BREAK = '<div style="page-break-after: always;"></div>';

async function buildHtml(id) {
  const htmlCoverPage = await generateCoverPage(id);
  const htmlApprovalPage = await generateApprovalPage(id);
  const htmlContentPage = await generateContentPage(id);

  const body = [htmlCoverPage, htmlApprovalPage, htmlContentPage].join(
    PAGE_BREAK
  );

  return wrapHtml(body);
}

async function createPDF(fullHtml) {
  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-software-rasterizer",
      "--disable-features=VizDisplayCompositor",
      "--disable-extensions",
      "--disable-dev-tools",
      "--no-zygote",
    ],
    headless: "new",
  });
  const page = await browser.newPage();

  await page.setContent(fullHtml, {
    waitUntil: "networkidle0",
  });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20mm",
      bottom: "20mm",
      left: "30mm",
      right: "10mm",
    },
  });

  await browser.close();
  return pdf;
}

async function generatePDF(id) {
  const fullHtml = await buildHtml(id);
  const pdfBuffer = await createPDF(fullHtml);
  return pdfBuffer;
}

module.exports = generatePDF;
module.exports.buildHtml = buildHtml;
