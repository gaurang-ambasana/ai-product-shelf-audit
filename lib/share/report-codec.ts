import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { auditReportV1Schema, type AuditReportV1 } from "@/lib/types/report";

/** Browser URL practical limit — stay conservative */
export const MAX_SHARE_PARAM_LENGTH = 6000;

export function encodeReportForUrl(report: AuditReportV1): { payload: string; tooLarge: boolean } {
  const json = JSON.stringify(report);
  const payload = compressToEncodedURIComponent(json);
  return {
    payload,
    tooLarge: payload.length > MAX_SHARE_PARAM_LENGTH,
  };
}

export function decodeReportFromUrl(param: string): AuditReportV1 | null {
  const json = decompressFromEncodedURIComponent(param);
  if (!json) return null;
  try {
    const data = JSON.parse(json) as unknown;
    const parsed = auditReportV1Schema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
