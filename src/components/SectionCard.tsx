import { type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, shadow, SYSTEM_FONT } from "../lib/theme";

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    padding: 20,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    ...shadow.card,
  },
  sectionTitle: {
    color: colors.label,
    fontFamily: SYSTEM_FONT,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: colors.labelTertiary,
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionBody: {
    marginTop: 16,
    gap: 14,
  },
});
