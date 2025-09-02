const puppeteer = require("puppeteer");
const {
  generateCoverPage,
  generateApprovalPage,
  generateContentPage,
} = require("./page-generator");

async function createPDF(htmlPages) {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-features=VizDisplayCompositor',
      '--disable-extensions',
      '--disable-dev-tools',
      '--no-zygote',
    ],
    headless: 'new', // Use 'true' or 'new' depending on Puppeteer version
  });
  const page = await browser.newPage();
  const fullHtml = htmlPages.join(
    '<div style="page-break-after: always;"></div>'
  );

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
  const htmlCoverPage = await generateCoverPage(id);
  const htmlApprovalPage = await generateApprovalPage(id);
  const htmlContentPage = await generateContentPage(id);

  const pdfBuffer = await createPDF([
    htmlCoverPage,
    htmlApprovalPage,
    htmlContentPage,
  ]);
  return pdfBuffer;
}

module.exports = generatePDF;

