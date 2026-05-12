import * as cheerio from "cheerio";
import type { PageEvidence } from "@/lib/types/crawl";
import { parseJsonLdFromHtml } from "./jsonld";

function stripText(html: string): string {
  const $ = cheerio.load(html);
  return $("body").text().replace(/\s+/g, " ").trim();
}

export function extractPageEvidence(html: string): PageEvidence {
  const $ = cheerio.load(html);
  const ld = parseJsonLdFromHtml(html);

  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ?? null;
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() ?? null;
  const ogDescription =
    $('meta[property="og:description"]').attr("content")?.trim() ?? null;

  let faqCount = 0;
  $("[data-faq], .faq, #faq, section").each((_, el) => {
    const t = $(el).text().toLowerCase();
    if (t.includes("faq") || $(el).find("details").length) faqCount += 1;
  });
  faqCount += $('details summary, [itemprop="name"]').length > 0 ? 1 : 0;

  const body = stripText(html).toLowerCase();
  let reviewSignal: PageEvidence["reviewSignal"] = "none";
  if (ld.hasAggregateRating) reviewSignal = "aggregate_in_schema";
  else if (
    body.includes("reviews") ||
    body.includes("star rating") ||
    body.includes("yotpo") ||
    body.includes("judge.me") ||
    $("[data-review], .yotpo, .jdgm-rev, .stamped-reviews").length > 0
  ) {
    reviewSignal = "widget_heuristic";
  }

  const imgs = $("img")
    .map((_, el) => ({
      alt: $(el).attr("alt")?.trim() ?? "",
      src: $(el).attr("src") ?? "",
    }))
    .get()
    .filter((x) => x.src.length > 0);
  const withAlt = imgs.filter((i) => i.alt.length > 0).length;
  const imageAltCoverage = imgs.length ? withAlt / imgs.length : 0;

  const specs: string[] = [];
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td,th").map((__, c) => $(c).text().trim()).get();
    if (cells.length >= 2 && cells[0] && cells[1]) {
      specs.push(`${cells[0]}: ${cells[1]}`);
    }
  });

  return {
    jsonLdTypes: ld.types.slice(0, 40),
    hasProductSchema: ld.hasProduct,
    hasOffer: ld.hasOffer,
    hasAggregateRating: ld.hasAggregateRating,
    hasFaqSchema: ld.hasFaqPage,
    metaDescription,
    ogTitle,
    ogDescription,
    faqCount,
    reviewSignal,
    imageAltCoverage,
    specs: specs.slice(0, 30),
  };
}
