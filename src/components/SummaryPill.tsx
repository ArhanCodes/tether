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
    backgroundColor: "#fbf8ef",
    borderWidth: 1,
    borderColor: "#d8ceb9",
  },
  summaryPillLabel: {
    color: "#697972",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  summaryPillValue: {
    marginTop: 8,
    color: "#10211d",
    fontSize: 15,
    fontWeight: "700",
  },
});
