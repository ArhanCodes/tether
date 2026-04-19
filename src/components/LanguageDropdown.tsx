import { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { SUPPORTED_LANGUAGES, type Language } from "../lib/LanguageContext";
import { colors, radius, shadow, SYSTEM_FONT } from "../lib/theme";

export function LanguageDropdown({
  current,
  onSelect,
}: {
  current: Language;
  onSelect: (lang: Language) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.trigger} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.triggerText}>{current}</Text>
        <Text style={styles.arrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>

      {open ? (
        <View style={styles.menu}>
          {SUPPORTED_LANGUAGES.map((lang, idx) => (
            <Pressable
              key={lang}
              style={[
                styles.option,
                idx < SUPPORTED_LANGUAGES.length - 1 && styles.optionDivider,
                lang === current && styles.optionActive,
              ]}
              onPress={() => {
                setOpen(false);
                onSelect(lang);
              }}
            >
              <Text style={[styles.optionText, lang === current && styles.optionTextActive]}>
                {lang}
              </Text>
              {lang === current ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 50,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bgGrouped,
    borderRadius: radius.medium,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  triggerText: {
    color: colors.label,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "500",
  },
  arrow: {
    color: colors.labelTertiary,
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
  },
  menu: {
    marginTop: 6,
    backgroundColor: colors.bgCard,
    borderRadius: radius.large,
    overflow: "hidden",
    ...shadow.floating,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  optionDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  optionActive: {
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    color: colors.label,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "400",
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  check: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});
