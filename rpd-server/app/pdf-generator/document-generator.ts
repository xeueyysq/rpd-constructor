import puppeteer from "puppeteer";
import {
  wrapHtml,
  generateCoverPage,
  generateApprovalPage,
  generateContentPage,
} from "./page-generator.ts";

const PAGE_BREAK = '<div style="page-break-after: always;"></div>';

async function buildHtml(id: unknown) {
  const htmlCoverPage = await generateCoverPage(id);
  const htmlApprovalPage = await generateApprovalPage(id);
  const htmlContentPage = await generateContentPage(id);

  const body = [htmlCoverPage, htmlApprovalPage, htmlContentPage].join(
    PAGE_BREAK
  );

  return wrapHtml(body);
}

async function createPDF(fullHtml: string) {
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
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "30mm", right: "10mm" },
    });
  } finally {
    await browser.close();
  }
}

async function generatePDF(id: unknown) {
  const fullHtml = await buildHtml(id);
  const pdfBuffer = await createPDF(fullHtml);
  return pdfBuffer;
}

export default generatePDF;
export { buildHtml };
