import { View, Text, StyleSheet } from "react-native";
import type { BiomarkerReport } from "../lib/biomarker";

const STATUS_COLORS = {
  normal: { bg: "#cce2d8", text: "#1a5e42" },
  monitor: { bg: "#ecd49d", text: "#5a4718" },
  alert: { bg: "#e6b9ae", text: "#7a2e1e" },
} as const;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function BiomarkerCard({ report }: { report: BiomarkerReport }) {
  const colors = STATUS_COLORS[report.status];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Voice Biomarkers</Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusText, { color: colors.text }]}>
            {report.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.summary}>{report.summary}</Text>

      <View style={styles.metricsGrid}>
        <Metric label="Voice Energy" value={`${report.energy}`} />
        <Metric label="Breathing Rate" value={`${report.breathing_rate}/min`} />
        <Metric label="Pitch Variability" value={`${report.pitch_variability}`} />
        <Metric label="Cough Events" value={`${report.cough_events}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#fbf8ef",
    borderWidth: 1,
    borderColor: "#d8ceb9",
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#10211d",
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
  summary: {
    color: "#243631",
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
    backgroundColor: "#f2eee3",
  },
  metricLabel: {
    color: "#697972",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 4,
    color: "#10211d",
    fontSize: 15,
    fontWeight: "700",
  },
});
