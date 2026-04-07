import { useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";

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
        placeholderTextColor="#94a3b8"
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
    gap: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#0f172a",
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 110,
  },
  inputFocused: {
    borderColor: "#3b82f6",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
});
