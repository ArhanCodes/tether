import { useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { CheckboxRow } from "../components/CheckboxRow";
import { InputField } from "../components/InputField";
import { LanguageDropdown } from "../components/LanguageDropdown";
import { SectionCard } from "../components/SectionCard";
import {
  login,
  signup,
  normalizeEmail,
  saveSession,
  cacheUser,
  saveDoctorDraft,
  buildDoctorStarterDraft,
  type UserAccount,
  type UserRole,
} from "../lib/appData";
import { useLanguage, SUPPORTED_LANGUAGES, type Language } from "../lib/LanguageContext";
import type { RootStackParamList } from "../lib/navigationTypes";

type AuthMode = "login" | "signup";

type Props = NativeStackScreenProps<RootStackParamList, "Auth">;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /\d/.test(value);
}

export function AuthScreen({ navigation }: Props) {
  const { i, language, setLanguage } = useLanguage();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authRole, setAuthRole] = useState<UserRole>("patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignUp() {
    const normalized = normalizeEmail(email);

    if (!fullName.trim() || fullName.trim().length < 2) {
      Alert.alert(i.invalidName, i.invalidNameMsg);
      return;
    }
    if (!isValidEmail(normalized)) {
      Alert.alert(i.invalidEmail, i.invalidEmailMsg);
      return;
    }
    if (!isStrongPassword(password.trim())) {
      Alert.alert(i.weakPassword, i.weakPasswordMsg);
      return;
    }
    if (!acceptedTerms) {
      Alert.alert(i.consentRequired, i.consentRequiredMsg);
      return;
    }

    setIsSubmitting(true);
    try {
      const account = await signup({
        name: fullName,
        email: normalized,
        password,
        role: authRole,
      });

      await saveSession({ userId: account.id });
      await cacheUser(account);

      if (account.role === "doctor") {
        const draft = buildDoctorStarterDraft(account);
        await saveDoctorDraft(account.email, draft);
      }

      setPassword("");
      setAcceptedTerms(false);

      navigation.reset({
        index: 0,
        routes: [
          {
            name: account.role === "doctor" ? "DoctorWorkspace" : "PatientCompanion",
            params: { user: account },
          },
        ],
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Something went wrong during signup.");
      console.error("Signup error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogIn() {
    const normalized = normalizeEmail(email);

    if (!isValidEmail(normalized) || !password.trim()) {
      Alert.alert(i.missingLogin, i.missingLoginMsg);
      return;
    }

    setIsSubmitting(true);
    try {
      const matched = await login(normalized, password);

      await saveSession({ userId: matched.id });
      await cacheUser(matched);
      setPassword("");

      navigation.reset({
        index: 0,
        routes: [
          {
            name: matched.role === "doctor" ? "DoctorWorkspace" : "PatientCompanion",
            params: { user: matched },
          },
        ],
      });
    } catch (error: any) {
      Alert.alert(i.loginFailed, error.message || i.missingLoginMsg);
      console.error("Login error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <LanguageDropdown current={language} onSelect={setLanguage} />

      <SectionCard
        title={authMode === "login" ? i.logIn : i.createAccount}
        subtitle={i.authSubtitle}
      >
        <View style={styles.roleTabs}>
          <Pressable
            onPress={() => setAuthMode("login")}
            style={[styles.roleButton, authMode === "login" && styles.roleButtonActive]}
          >
            <Text style={[styles.roleButtonText, authMode === "login" && styles.roleButtonTextActive]}>
              {i.logIn}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setAuthMode("signup")}
            style={[styles.roleButton, authMode === "signup" && styles.roleButtonActive]}
          >
            <Text style={[styles.roleButtonText, authMode === "signup" && styles.roleButtonTextActive]}>
              {i.signUp}
            </Text>
          </Pressable>
        </View>

        {authMode === "signup" ? (
          <View style={styles.roleTabs}>
            <Pressable
              onPress={() => setAuthRole("doctor")}
              style={[styles.roleButton, authRole === "doctor" && styles.roleButtonActive]}
            >
              <Text style={[styles.roleButtonText, authRole === "doctor" && styles.roleButtonTextActive]}>
                {i.doctor}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAuthRole("patient")}
              style={[styles.roleButton, authRole === "patient" && styles.roleButtonActive]}
            >
              <Text style={[styles.roleButtonText, authRole === "patient" && styles.roleButtonTextActive]}>
                {i.patient}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {authMode === "signup" ? (
          <InputField
            label={i.fullName}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ava Thompson"
            autoCapitalize="words"
          />
        ) : null}

        <InputField
          label={i.email}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <InputField
          label={i.password}
          value={password}
          onChangeText={setPassword}
          placeholder={i.password}
          secureTextEntry
          autoCapitalize="none"
        />

        {authMode === "signup" ? (
          <CheckboxRow
            checked={acceptedTerms}
            onPress={() => setAcceptedTerms((v) => !v)}
            label={i.termsConsent}
          />
        ) : null}

        <Pressable
          style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          onPress={() => void (authMode === "login" ? handleLogIn() : handleSignUp())}
          disabled={isSubmitting}
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting
              ? i.pleaseWait
              : authMode === "login"
                ? i.logIn
                : authRole === "doctor" ? i.createDoctorAccount : i.createPatientAccount}
          </Text>
        </Pressable>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>{i.releaseOnboarding}</Text>
          <Text style={styles.infoCardText}>
            {i.releaseOnboardingText}
          </Text>
        </View>
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  roleTabs: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    gap: 2,
  },
  roleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 8,
  },
  roleButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  roleButtonText: {
    color: "#8E8E93",
    fontWeight: "500",
    fontSize: 14,
    letterSpacing: -0.2,
  },
  roleButtonTextActive: {
    color: "#1C1C1E",
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  infoCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    gap: 4,
  },
  infoCardTitle: {
    color: "#1C1C1E",
    fontWeight: "600",
    fontSize: 14,
  },
  infoCardText: {
    color: "#3C3C43",
    fontSize: 13,
    lineHeight: 18,
  },
});
