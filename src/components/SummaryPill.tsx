import { View, Text, StyleSheet } from "react-native";

export function SummaryPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryPillLabel}>{label}</Text>
      <Text style={styles.summaryPillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryPill: {
    minWidth: "47%",
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryPillLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  summaryPillValue: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
});
