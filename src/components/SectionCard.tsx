import { type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";

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
    padding: 18,
    borderRadius: 26,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
  },
  sectionSubtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 21,
  },
  sectionBody: {
    marginTop: 18,
    gap: 16,
  },
});
