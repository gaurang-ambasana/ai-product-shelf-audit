import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { AuditReportV1 } from "@/lib/types/report";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111",
  },
  h1: { fontSize: 18, marginBottom: 8, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 12, marginTop: 12, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  p: { marginBottom: 4, lineHeight: 1.4 },
  small: { fontSize: 8, color: "#444", marginTop: 12 },
  row: { marginBottom: 2 },
});

export function ReportPdfDocument({ report }: { report: AuditReportV1 }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Product shelf check</Text>
        <Text style={styles.p}>{report.storeUrl}</Text>
        <Text style={styles.p}>Generated: {report.generatedAt}</Text>
        <Text style={styles.p}>Overall shelf score: {report.overallScore}</Text>
        <Text style={styles.small}>{report.disclaimer}</Text>
        <Text style={styles.h2}>Sample shopper questions</Text>
        <Text style={styles.p}>Combined match: {report.brandAiSearchRank.composite}</Text>
        {report.brandAiSearchRank.perQuery.slice(0, 5).map((q) => (
          <Text key={q.query} style={styles.row}>
            • {q.query.slice(0, 90)}… — {q.brandScore}
            {q.rankAmong ? ` (vs other stores: #${q.rankAmong})` : ""}
          </Text>
        ))}
        <Text style={styles.h2}>Products reviewed</Text>
        {report.products.map((p) => (
          <View key={p.productId} wrap={false}>
            <Text style={styles.p}>
              {p.title} — {p.overall}
            </Text>
          </View>
        ))}
        <Text style={styles.h2}>Top recommendations</Text>
        {report.recommendations.slice(0, 12).map((r, i) => (
          <Text key={i} style={styles.row}>
            {i + 1}. {r}
          </Text>
        ))}
        {report.realWorldPromptResearch ? (
          <>
            <Text style={styles.h2}>Live web research (excerpt)</Text>
            <Text style={styles.small}>{report.realWorldPromptResearch.disclaimer}</Text>
            {report.realWorldPromptResearch.brandIntentResults.slice(0, 2).map((row) => (
              <View key={`b-${row.prompt}`} style={{ marginBottom: 8 }} wrap={false}>
                <Text style={styles.p}>{row.prompt}</Text>
                <Text style={styles.row}>
                  {row.analysis.length > 700 ? `${row.analysis.slice(0, 700)}…` : row.analysis}
                </Text>
              </View>
            ))}
            {report.realWorldPromptResearch.shoppingIntentResults.slice(0, 2).map((row) => (
              <View key={`s-${row.prompt}`} style={{ marginBottom: 8 }} wrap={false}>
                <Text style={styles.p}>{row.prompt}</Text>
                <Text style={styles.row}>
                  {row.analysis.length > 700 ? `${row.analysis.slice(0, 700)}…` : row.analysis}
                </Text>
              </View>
            ))}
          </>
        ) : null}
        <Text style={styles.small}>{report.weightsNote}</Text>
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Sample questions &amp; wording ideas</Text>
        <Text style={styles.h2}>Side-by-side for sample questions</Text>
        {report.simulation.map((s) => (
          <View key={s.prompt} style={{ marginBottom: 8 }}>
            <Text style={styles.p}>{s.prompt}</Text>
            {s.rankings.slice(0, 4).map((r) => (
              <Text key={r.label} style={styles.row}>
                — {r.label}: {r.score}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.h2}>Suggested titles (excerpt)</Text>
        {report.rewrites.map((rw) => (
          <View key={rw.productId} wrap={false} style={{ marginBottom: 10 }}>
            <Text style={styles.p}>{rw.title}</Text>
            <Text style={styles.p}>{rw.suggestedTitle}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
