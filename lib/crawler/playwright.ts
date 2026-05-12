import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium, type Browser } from "playwright-core";

export async function getBrowser(): Promise<Browser> {
  const isServerless = !!process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    const executablePath = await chromium.executablePath();
    return playwrightChromium.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }

  return playwrightChromium.launch({
    headless: true,
  });
}

export async function fetchRenderedHtml(url: string, timeoutMs: number): Promise<string> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}
