import { View, Text, StyleSheet } from "react-native";
import type { BiomarkerReport } from "../lib/biomarker";
import type { BiomarkerRecord } from "../lib/appData";

const STATUS_COLORS = {
  normal: { bg: "#dcfce7", text: "#166534" },
  monitor: { bg: "#fef3c7", text: "#92400e" },
  alert: { bg: "#fee2e2", text: "#991b1b" },
} as const;

const METRIC_EXPLANATIONS: Record<string, string> = {
  "Voice Energy": "How strong your voice sounds. Low values may indicate fatigue.",
  "Breathing Rate": "Estimated breaths per minute. Normal is 12–20/min.",
  "Pitch Variability": "How much your voice pitch fluctuates. High values may indicate tremor.",
  "Cough Events": "Number of cough-like bursts detected in the recording.",
};

function deltaArrow(current: number, previous: number | undefined): string {
  if (previous === undefined) return "";
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return " →";
  return diff > 0 ? " ↑" : " ↓";
}

function Metric({
  label,
  value,
  previousValue,
  explanation,
}: {
  label: string;
  value: string;
  previousValue?: number;
  explanation?: string;
}) {
  const currentNum = parseFloat(value);
  const arrow = !isNaN(currentNum) ? deltaArrow(currentNum, previousValue) : "";

  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value}
        {arrow ? <Text style={arrow.includes("↑") ? styles.deltaUp : arrow.includes("↓") ? styles.deltaDown : styles.deltaSame}>{arrow}</Text> : null}
      </Text>
      {explanation ? <Text style={styles.metricExplanation}>{explanation}</Text> : null}
    </View>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.7 ? "#166534" : confidence >= 0.4 ? "#92400e" : "#991b1b";
  const bg = confidence >= 0.7 ? "#dcfce7" : confidence >= 0.4 ? "#fef3c7" : "#fee2e2";
  const label = confidence >= 0.7 ? "High" : confidence >= 0.4 ? "Moderate" : "Low";

  return (
    <View style={[styles.confidenceBadge, { backgroundColor: bg }]}>
      <Text style={[styles.confidenceText, { color }]}>
        {label} confidence ({pct}%)
      </Text>
    </View>
  );
}

function TrendBar({ values, max, color }: { values: number[]; max: number; color: string }) {
  if (values.length === 0) return null;
  const barMax = Math.max(max, ...values, 1);
  return (
    <View style={styles.trendBarRow}>
      {values.slice(-10).map((v, i) => (
        <View
          key={i}
          style={[
            styles.trendBarItem,
            { height: Math.max(4, (v / barMax) * 40), backgroundColor: color },
          ]}
        />
      ))}
    </View>
  );
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function BiomarkerCard({
  report,
  history,
}: {
  report: BiomarkerReport;
  history?: BiomarkerRecord[];
}) {
  const statusColors = STATUS_COLORS[report.status];
  const breathingValues = history?.map(h => h.report.breathing_rate) ?? [];
  const energyValues = history?.map(h => h.report.energy) ?? [];
  const coughValues = history?.map(h => h.report.cough_events) ?? [];
  const hasHistory = (history?.length ?? 0) > 1;

  // Previous reading for delta arrows
  const prev = hasHistory ? history![history!.length - 2]?.report : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Voice Biomarkers</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {report.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {report.confidence !== undefined ? (
        <ConfidenceBadge confidence={report.confidence} />
      ) : null}

      <Text style={styles.summary}>{report.summary}</Text>

      <View style={styles.metricsGrid}>
        <Metric
          label="Voice Energy"
          value={`${report.energy}`}
          previousValue={prev?.energy}
          explanation={METRIC_EXPLANATIONS["Voice Energy"]}
        />
        <Metric
          label="Breathing Rate"
          value={`${report.breathing_rate}/min`}
          previousValue={prev?.breathing_rate}
          explanation={METRIC_EXPLANATIONS["Breathing Rate"]}
        />
        <Metric
          label="Pitch Variability"
          value={`${report.pitch_variability}`}
          previousValue={prev?.pitch_variability}
          explanation={METRIC_EXPLANATIONS["Pitch Variability"]}
        />
        <Metric
          label="Cough Events"
          value={`${report.cough_events}`}
          previousValue={prev?.cough_events}
          explanation={METRIC_EXPLANATIONS["Cough Events"]}
        />
      </View>

      {hasHistory ? (
        <View style={styles.trendSection}>
          <Text style={styles.trendTitle}>Trends (last {Math.min(history!.length, 10)} readings)</Text>

          <View style={styles.trendRow}>
            <Text style={styles.trendLabel}>Breathing</Text>
            <TrendBar values={breathingValues} max={30} color="#3b82f6" />
          </View>

          <View style={styles.trendRow}>
            <Text style={styles.trendLabel}>Energy</Text>
            <TrendBar values={energyValues} max={1} color="#22c55e" />
          </View>

          <View style={styles.trendRow}>
            <Text style={styles.trendLabel}>Coughs</Text>
            <TrendBar values={coughValues} max={10} color="#f59e0b" />
          </View>

          <View style={styles.trendTimeline}>
            <Text style={styles.trendTimeLabel}>{formatDate(history![Math.max(0, history!.length - 10)].timestamp)}</Text>
            <Text style={styles.trendTimeLabel}>Now</Text>
          </View>

          {/* Alert count */}
          {(() => {
            const alerts = history!.filter(h => h.report.status === "alert").length;
            const monitors = history!.filter(h => h.report.status === "monitor").length;
            return (
              <View style={styles.trendSummaryRow}>
                <View style={[styles.trendSummaryPill, { backgroundColor: "#fee2e2" }]}>
                  <Text style={[styles.trendSummaryText, { color: "#991b1b" }]}>{alerts} alerts</Text>
                </View>
                <View style={[styles.trendSummaryPill, { backgroundColor: "#fef3c7" }]}>
                  <Text style={[styles.trendSummaryText, { color: "#92400e" }]}>{monitors} monitors</Text>
                </View>
                <View style={[styles.trendSummaryPill, { backgroundColor: "#dcfce7" }]}>
                  <Text style={[styles.trendSummaryText, { color: "#166534" }]}>{history!.length - alerts - monitors} normal</Text>
                </View>
              </View>
            );
          })()}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  confidenceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "700",
  },
  summary: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metric: {
    minWidth: "45%",
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  metricExplanation: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 15,
  },
  deltaUp: {
    color: "#dc2626",
    fontWeight: "800",
  },
  deltaDown: {
    color: "#16a34a",
    fontWeight: "800",
  },
  deltaSame: {
    color: "#94a3b8",
    fontWeight: "800",
  },
  trendSection: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  trendTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  trendLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    width: 68,
  },
  trendBarRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 40,
  },
  trendBarItem: {
    flex: 1,
    borderRadius: 3,
    minWidth: 4,
  },
  trendTimeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginLeft: 76,
  },
  trendTimeLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
  },
  trendSummaryRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  trendSummaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  trendSummaryText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
