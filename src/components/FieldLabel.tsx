import { Text, StyleSheet } from "react-native";
import { colors, SYSTEM_FONT } from "../lib/theme";

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: colors.labelSecondary,
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 4,
  },
});
