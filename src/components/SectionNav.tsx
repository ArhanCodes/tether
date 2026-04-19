import { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { colors, radius, shadow, SYSTEM_FONT } from "../lib/theme";

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
          {items.map((item, idx) => (
            <Pressable
              key={item.key}
              style={[
                styles.menuItem,
                idx < items.length - 1 && styles.menuItemDivider,
              ]}
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
    backgroundColor: colors.bgCard,
    borderRadius: radius.medium,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadow.card,
  },
  hamburgerIcon: {
    fontFamily: SYSTEM_FONT,
    fontSize: 20,
    color: colors.primary,
    fontWeight: "600",
  },
  menu: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderRadius: radius.large,
    overflow: "hidden",
    ...shadow.floating,
  },
  menuItem: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  menuItemDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  menuItemText: {
    color: colors.primary,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "500",
  },
});
