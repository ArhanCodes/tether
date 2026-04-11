import { Pressable, ScrollView, Text, View, StyleSheet } from "react-native";

export type NavItem = {
  key: string;
  label: string;
};

export function SectionNav({
  items,
  onPress,
}: {
  items: NavItem[];
  onPress: (key: string) => void;
}) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((item) => (
          <Pressable
            key={item.key}
            style={styles.chip}
            onPress={() => onPress(item.key)}
          >
            <Text style={styles.chipText}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  scroll: {
    gap: 8,
    paddingHorizontal: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
  },
  chipText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "700",
  },
});
