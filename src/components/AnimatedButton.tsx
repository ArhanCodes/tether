import { useRef } from "react";
import {
  Animated,
  Pressable,
  Text,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { colors, radius, SYSTEM_FONT } from "../lib/theme";

type ButtonVariant = "primary" | "secondary" | "voice" | "voiceActive" | "danger";

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string }> = {
  primary: { bg: colors.primary, text: "#ffffff" },
  secondary: { bg: colors.bgGrouped, text: colors.label },
  voice: { bg: colors.primarySoft, text: colors.primary },
  voiceActive: { bg: colors.primaryDark, text: "#ffffff" },
  danger: { bg: colors.dangerSoft, text: colors.danger },
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
  const variantColors = VARIANT_STYLES[variant];

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
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
          { backgroundColor: variantColors.bg },
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.text, { color: variantColors.text }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.medium,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  text: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  disabled: {
    opacity: 0.5,
  },
});
