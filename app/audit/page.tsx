import { Suspense } from "react";
import { AuditClient } from "@/components/audit/AuditClient";

export default function AuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditClient />
    </Suspense>
  );
}
