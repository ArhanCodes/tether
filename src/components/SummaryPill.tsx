import { View, Text, StyleSheet } from "react-native";
import { colors, radius, SYSTEM_FONT } from "../lib/theme";

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
    borderRadius: radius.medium,
    backgroundColor: colors.bgGrouped,
  },
  summaryPillLabel: {
    color: colors.labelTertiary,
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  summaryPillValue: {
    marginTop: 4,
    color: colors.label,
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
