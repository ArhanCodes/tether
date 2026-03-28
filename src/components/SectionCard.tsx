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
    backgroundColor: "#f2eee3",
  },
  sectionTitle: {
    color: "#10211d",
    fontSize: 24,
    fontWeight: "800",
  },
  sectionSubtitle: {
    marginTop: 6,
    color: "#536760",
    fontSize: 14,
    lineHeight: 21,
  },
  sectionBody: {
    marginTop: 18,
    gap: 16,
  },
});
