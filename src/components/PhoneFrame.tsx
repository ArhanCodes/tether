import { Platform, View, Text, StyleSheet, useWindowDimensions } from "react-native";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

function StatusBarClock() {
  const [time, setTime] = useState(() => formatTime());

  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  return <Text style={styles.clock}>{time}</Text>;
}

function formatTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();

  if (Platform.OS !== "web" || width < 500) {
    return <>{children}</>;
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.phone}>
        {/* Status bar */}
        <View style={styles.statusBar}>
          <StatusBarClock />
          <View style={styles.dynamicIsland} />
          <View style={styles.statusIcons}>
            {/* Signal bars */}
            <View style={styles.signalGroup}>
              <View style={[styles.signalBar, styles.signalBar1]} />
              <View style={[styles.signalBar, styles.signalBar2]} />
              <View style={[styles.signalBar, styles.signalBar3]} />
              <View style={[styles.signalBar, styles.signalBar4]} />
            </View>
            {/* WiFi */}
            <Text style={styles.statusIcon}>WiFi</Text>
            {/* Battery */}
            <View style={styles.battery}>
              <View style={styles.batteryFill} />
              <View style={styles.batteryTip} />
            </View>
          </View>
        </View>

        {/* App content */}
        <View style={styles.screen}>{children}</View>

        {/* Home indicator */}
        <View style={styles.homeIndicatorArea}>
          <View style={styles.homeIndicator} />
        </View>
      </View>
    </View>
  );
}

const PHONE_WIDTH = 393;
const PHONE_HEIGHT = 852;
const BEZEL = 12;
const CORNER = 55;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  phone: {
    width: PHONE_WIDTH + BEZEL * 2,
    height: PHONE_HEIGHT + BEZEL * 2,
    backgroundColor: "#18181b",
    borderRadius: CORNER,
    borderWidth: 3,
    borderColor: "#3f3f46",
    overflow: "hidden",
    padding: BEZEL,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 30,
  },

  // Status bar
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 54,
    paddingHorizontal: 28,
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: CORNER - BEZEL - 3,
    borderTopRightRadius: CORNER - BEZEL - 3,
    zIndex: 10,
  },
  clock: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    width: 80,
  },
  dynamicIsland: {
    width: 120,
    height: 34,
    borderRadius: 20,
    backgroundColor: "#18181b",
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    width: 80,
    gap: 6,
  },
  signalGroup: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1.5,
    height: 12,
  },
  signalBar: {
    width: 3,
    backgroundColor: "#0f172a",
    borderRadius: 1,
  },
  signalBar1: { height: 4 },
  signalBar2: { height: 6 },
  signalBar3: { height: 9 },
  signalBar4: { height: 12 },
  statusIcon: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0f172a",
  },
  battery: {
    width: 24,
    height: 11,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#0f172a",
    padding: 1.5,
    flexDirection: "row",
    alignItems: "center",
  },
  batteryFill: {
    flex: 1,
    height: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 1.5,
  },
  batteryTip: {
    position: "absolute",
    right: -4,
    width: 2,
    height: 5,
    backgroundColor: "#0f172a",
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  // Screen content
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },

  // Home indicator
  homeIndicatorArea: {
    height: 34,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
    borderBottomLeftRadius: CORNER - BEZEL - 3,
    borderBottomRightRadius: CORNER - BEZEL - 3,
  },
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#0f172a",
  },
});
