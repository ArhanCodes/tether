import { useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { colors, radius, SYSTEM_FONT } from "../lib/theme";

import { FieldLabel } from "./FieldLabel";

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.labelTertiary}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        textAlignVertical={multiline ? "top" : "center"}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          isFocused && styles.inputFocused,
        ]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    gap: 6,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.medium,
    backgroundColor: colors.bgGrouped,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.label,
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 96,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.bgCard,
  },
});
