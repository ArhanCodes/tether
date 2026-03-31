import { useState } from "react";
import { Pressable, Text, View, StyleSheet, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

const { width } = Dimensions.get("window");

const STEPS = [
  {
    icon: "T",
    title: "Welcome to Tether",
    body: "Tether connects doctors and patients after hospital discharge. Your doctor publishes a personalized recovery plan, and you get AI-powered guidance anytime.",
  },
  {
    icon: "D",
    title: "For Doctors",
    body: "Create detailed recovery plans with medications, daily instructions, red flags, and follow-up schedules. Publish them to specific patient accounts and respond to messages.",
  },
  {
    icon: "P",
    title: "For Patients",
    body: "View your recovery plan, ask the AI questions by text or voice, and message your doctor when you need a human answer. Quick prompts help you get started.",
  },
  {
    icon: "V",
    title: "Voice Biomarkers",
    body: "When you use voice chat, Tether analyzes your voice for health signals like breathing rate, cough patterns, and vocal tremor — all processed securely on the edge.",
  },
  {
    icon: "!",
    title: "Safety First",
    body: "Tether helps explain your doctor's plan but never replaces emergency care. If symptoms feel severe or unsafe, seek immediate medical help — don't wait for chat responses.",
  },
];

export const ONBOARDING_KEY = "tether-onboarding-complete";

export function OnboardingScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function handleNext() {
    if (isLast) {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
    } else {
      setStep(step + 1);
    }
  }

  async function handleSkip() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{current.icon}</Text>
        </View>

        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>

        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        {!isLast ? (
          <Pressable onPress={() => void handleSkip()} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.skipButton} />
        )}

        <Pressable onPress={() => void handleNext()} style={styles.nextButton}>
          <Text style={styles.nextText}>{isLast ? "Get Started" : "Next"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 50,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1d4ed8",
    borderWidth: 2,
    borderColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    color: "#94a3b8",
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
    maxWidth: width * 0.85,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#334155",
  },
  dotActive: {
    backgroundColor: "#60a5fa",
    width: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skipButton: {
    minWidth: 70,
    paddingVertical: 14,
  },
  skipText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#1d4ed8",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  nextText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
