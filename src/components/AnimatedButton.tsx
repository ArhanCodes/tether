import { useRef } from "react";
import {
  Animated,
  Pressable,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native";

type ButtonVariant = "primary" | "secondary" | "voice" | "voiceActive" | "danger";

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string }> = {
  primary: { bg: "#1d4ed8", text: "#ffffff" },
  secondary: { bg: "#e2e8f0", text: "#0f172a" },
  voice: { bg: "#dbeafe", text: "#1d4ed8" },
  voiceActive: { bg: "#2563eb", text: "#ffffff" },
  danger: { bg: "#fee2e2", text: "#991b1b" },
};

export function AnimatedButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const colors = VARIANT_STYLES[variant];

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }

  return (
    <Animated.View style={[{ transform: [{ scale }], flex: 1 }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="button"
        style={[
          styles.button,
          { backgroundColor: colors.bg },
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  text: {
    fontWeight: "800",
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});
