import { Platform, View, StyleSheet, useWindowDimensions } from "react-native";
import type { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();

  // Only show the frame on web with a wide viewport (desktop browser)
  if (Platform.OS !== "web" || width < 500) {
    return <>{children}</>;
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.phone}>
        <View style={styles.notch} />
        <View style={styles.screen}>{children}</View>
        <View style={styles.homeBar} />
      </View>
    </View>
  );
}

const PHONE_WIDTH = 393;
const PHONE_HEIGHT = 852;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  phone: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    backgroundColor: "#0f172a",
    borderRadius: 52,
    borderWidth: 4,
    borderColor: "#1e293b",
    overflow: "hidden",
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 24,
  },
  notch: {
    alignSelf: "center",
    width: 126,
    height: 34,
    backgroundColor: "#0f172a",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    zIndex: 10,
  },
  screen: {
    flex: 1,
    marginTop: -6,
    backgroundColor: "#f8fafc",
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    overflow: "hidden",
  },
  homeBar: {
    alignSelf: "center",
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#64748b",
    marginVertical: 8,
  },
});
