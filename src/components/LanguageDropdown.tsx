import { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { SUPPORTED_LANGUAGES, type Language } from "../lib/LanguageContext";

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
          {SUPPORTED_LANGUAGES.map((lang) => (
            <Pressable
              key={lang}
              style={[styles.option, lang === current && styles.optionActive]}
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
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerText: {
    color: "#1d4ed8",
    fontSize: 15,
    fontWeight: "700",
  },
  arrow: {
    color: "#94a3b8",
    fontSize: 12,
  },
  menu: {
    marginTop: 6,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionActive: {
    backgroundColor: "#eff6ff",
  },
  optionText: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "600",
  },
  optionTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  check: {
    color: "#1d4ed8",
    fontSize: 16,
    fontWeight: "700",
  },
});
