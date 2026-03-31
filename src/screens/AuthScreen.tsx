import { useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { CheckboxRow } from "../components/CheckboxRow";
import { InputField } from "../components/InputField";
import { SectionCard } from "../components/SectionCard";
import {
  authenticateUser,
  getUsers,
  makeAccount,
  normalizeEmail,
  saveSession,
  saveUsers,
  saveDoctorDraft,
  buildDoctorStarterDraft,
  type UserAccount,
  type UserRole,
} from "../lib/appData";
import type { RootStackParamList } from "../navigation/AppNavigator";

type AuthMode = "login" | "signup";

type Props = NativeStackScreenProps<RootStackParamList, "Auth">;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /\d/.test(value);
}

export function AuthScreen({ navigation }: Props) {
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
      Alert.alert("Invalid name", "Enter your full name.");
      return;
    }
    if (!isValidEmail(normalized)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if (!isStrongPassword(password.trim())) {
      Alert.alert(
        "Weak password",
        "Use at least 8 characters and include at least one number.",
      );
      return;
    }
    if (!acceptedTerms) {
      Alert.alert(
        "Consent required",
        "You need to accept the Terms and Privacy notice before creating an account.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const users = await getUsers();
      if (users.some((u) => normalizeEmail(u.email) === normalized)) {
        Alert.alert("Account exists", "An account with that email already exists.");
        return;
      }

      const account = await makeAccount({
        name: fullName,
        email: normalized,
        password,
        role: authRole,
      });

      const nextUsers = [...users, account];
      await saveUsers(nextUsers);
      await saveSession({ userId: account.id });

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
    } catch (error) {
      Alert.alert("Error", "Something went wrong during signup. Please try again.");
      console.error("Signup error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogIn() {
    const normalized = normalizeEmail(email);

    if (!isValidEmail(normalized) || !password.trim()) {
      Alert.alert("Missing login details", "Enter a valid email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const users = await getUsers();
      const matched = await authenticateUser(users, normalized, password);

      if (!matched) {
        Alert.alert("Login failed", "That email and password combination was not found.");
        return;
      }

      await saveSession({ userId: matched.id });
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
    } catch (error) {
      Alert.alert("Error", "Something went wrong during login. Please try again.");
      console.error("Login error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <SectionCard
        title={authMode === "login" ? "Log In" : "Create Account"}
        subtitle="Choose your role during sign up. After login, Tether routes you to the correct home screen."
      >
        <View style={styles.roleTabs}>
          <Pressable
            onPress={() => setAuthMode("login")}
            style={[styles.roleButton, authMode === "login" && styles.roleButtonActive]}
          >
            <Text style={[styles.roleButtonText, authMode === "login" && styles.roleButtonTextActive]}>
              Log In
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setAuthMode("signup")}
            style={[styles.roleButton, authMode === "signup" && styles.roleButtonActive]}
          >
            <Text style={[styles.roleButtonText, authMode === "signup" && styles.roleButtonTextActive]}>
              Sign Up
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
                Doctor
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAuthRole("patient")}
              style={[styles.roleButton, authRole === "patient" && styles.roleButtonActive]}
            >
              <Text style={[styles.roleButtonText, authRole === "patient" && styles.roleButtonTextActive]}>
                Patient
              </Text>
            </Pressable>
          </View>
        ) : null}

        {authMode === "signup" ? (
          <InputField
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ava Thompson"
            autoCapitalize="words"
          />
        ) : null}

        <InputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <InputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
        />

        {authMode === "signup" ? (
          <CheckboxRow
            checked={acceptedTerms}
            onPress={() => setAcceptedTerms((v) => !v)}
            label="I agree to the Terms of Use and Privacy Notice, and I understand this app does not replace emergency care."
          />
        ) : null}

        <Pressable
          style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          onPress={() => void (authMode === "login" ? handleLogIn() : handleSignUp())}
          disabled={isSubmitting}
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting
              ? "Please wait..."
              : authMode === "login"
                ? "Log In"
                : `Create ${authRole} account`}
          </Text>
        </Pressable>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Release-style onboarding</Text>
          <Text style={styles.infoCardText}>
            Doctors and patients create separate accounts, and each user is
            routed into the correct side of the app automatically after login.
          </Text>
        </View>
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  roleTabs: {
    flexDirection: "row",
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    gap: 8,
  },
  roleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 999,
  },
  roleButtonActive: {
    backgroundColor: "#1d4ed8",
  },
  roleButtonText: {
    color: "#475569",
    fontWeight: "700",
  },
  roleButtonTextActive: {
    color: "#ffffff",
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    gap: 6,
  },
  infoCardTitle: {
    color: "#0f172a",
    fontWeight: "800",
  },
  infoCardText: {
    color: "#475569",
    lineHeight: 20,
  },
});
