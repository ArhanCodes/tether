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
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>Tether</Text>
        <Text style={styles.heroTitle}>
          Sign in as a doctor or patient and land in the right app instantly.
        </Text>
        <Text style={styles.heroText}>
          Doctors publish recovery plans. Patients receive those plans and can
          ask the AI for voice or text guidance based on what their doctor entered.
        </Text>
        <Text style={styles.heroSubtext}>
          Built for a clean release-style flow: account creation, role-based
          routing, in-app AI support, and doctor messaging.
        </Text>
      </View>

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
  heroCard: {
    padding: 22,
    borderRadius: 28,
    backgroundColor: "#10211d",
    borderWidth: 1,
    borderColor: "#1f3d37",
    gap: 14,
  },
  kicker: {
    color: "#8fd0bf",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#f3f4ef",
    fontSize: 33,
    lineHeight: 38,
    fontWeight: "800",
  },
  heroText: {
    color: "#adc1bb",
    fontSize: 15,
    lineHeight: 24,
  },
  heroSubtext: {
    color: "#85a09a",
    fontSize: 13,
    lineHeight: 20,
  },
  roleTabs: {
    flexDirection: "row",
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#e2d9c8",
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
    backgroundColor: "#10211d",
  },
  roleButtonText: {
    color: "#31443d",
    fontWeight: "700",
  },
  roleButtonTextActive: {
    color: "#f7f2e7",
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#10211d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#f8f7f1",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#fbf8ef",
    borderWidth: 1,
    borderColor: "#d8ceb9",
    gap: 6,
  },
  infoCardTitle: {
    color: "#10211d",
    fontWeight: "800",
  },
  infoCardText: {
    color: "#41534d",
    lineHeight: 20,
  },
});
