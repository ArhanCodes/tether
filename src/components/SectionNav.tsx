import { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";

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
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={styles.hamburger}
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel="Navigation menu"
        accessibilityRole="button"
      >
        <Text style={styles.hamburgerIcon}>{open ? "✕" : "☰"}</Text>
      </Pressable>

      {open ? (
        <View style={styles.menu}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              style={styles.menuItem}
              onPress={() => {
                setOpen(false);
                onPress(item.key);
              }}
            >
              <Text style={styles.menuItemText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 100,
  },
  hamburger: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hamburgerIcon: {
    fontSize: 20,
    color: "#1d4ed8",
    fontWeight: "700",
  },
  menu: {
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 6,
    overflow: "hidden",
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuItemText: {
    color: "#1d4ed8",
    fontSize: 15,
    fontWeight: "700",
  },
});
