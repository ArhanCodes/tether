import { useState } from "react";
import { Pressable, Text, View, StyleSheet, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLanguage } from "../lib/LanguageContext";
import type { RootStackParamList } from "../lib/navigationTypes";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

const { width } = Dimensions.get("window");

const STEP_ICONS = ["T", "D", "P", "V", "!"];

export const ONBOARDING_KEY = "tether-onboarding-complete";

export function OnboardingScreen({ navigation }: Props) {
  const { i } = useLanguage();
  const [step, setStep] = useState(0);

  const steps = [
    { icon: "T", title: i.welcomeTitle, body: i.welcomeBody },
    { icon: "D", title: i.forDoctorsTitle, body: i.forDoctorsBody },
    { icon: "P", title: i.forPatientsTitle, body: i.forPatientsBody },
    { icon: "V", title: i.voiceBiomarkersTitle, body: i.voiceBiomarkersOnboardBody },
    { icon: "!", title: i.safetyFirstTitle, body: i.safetyFirstBody },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

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
          {steps.map((_, idx) => (
            <View
              key={idx}
              style={[styles.dot, idx === step && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        {!isLast ? (
          <Pressable onPress={() => void handleSkip()} style={styles.skipButton}>
            <Text style={styles.skipText}>{i.skip}</Text>
          </Pressable>
        ) : (
          <View style={styles.skipButton} />
        )}

        <Pressable onPress={() => void handleNext()} style={styles.nextButton}>
          <Text style={styles.nextText}>{isLast ? i.getStarted : i.next}</Text>
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
