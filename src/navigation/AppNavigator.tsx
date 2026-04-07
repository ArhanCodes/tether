import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import {
  getSession,
  getCachedUser,
  type UserAccount,
} from "../lib/appData";
import { OnboardingScreen, ONBOARDING_KEY } from "../screens/OnboardingScreen";
import { AuthScreen } from "../screens/AuthScreen";
import { DoctorScreen } from "../screens/DoctorScreen";
import { PatientScreen } from "../screens/PatientScreen";

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  DoctorWorkspace: { user: UserAccount };
  PatientCompanion: { user: UserAccount };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function ScreenWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AuthWrapper(props: { navigation: any; route: any }) {
  return (
    <ScreenWrapper>
      <AuthScreen {...props} />
    </ScreenWrapper>
  );
}

function DoctorWrapper(props: { navigation: any; route: any }) {
  return (
    <ScreenWrapper>
      <DoctorScreen {...props} />
    </ScreenWrapper>
  );
}

function PatientWrapper(props: { navigation: any; route: any }) {
  return (
    <ScreenWrapper>
      <PatientScreen {...props} />
    </ScreenWrapper>
  );
}

export function AppNavigator() {
  const [isBooting, setIsBooting] = useState(true);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>("Onboarding");
  const [initialUser, setInitialUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const [session, onboarded] = await Promise.all([
          getSession(),
          AsyncStorage.getItem(ONBOARDING_KEY),
        ]);

        if (cancelled) return;

        if (!onboarded) {
          setInitialRoute("Onboarding");
        } else if (session) {
          const cachedUser = await getCachedUser();
          if (cachedUser) {
            setInitialUser(cachedUser);
            setInitialRoute(
              cachedUser.role === "doctor" ? "DoctorWorkspace" : "PatientCompanion",
            );
          } else {
            setInitialRoute("Auth");
          }
        } else {
          setInitialRoute("Auth");
        }
      } catch (error) {
        console.error("Boot error:", error);
        setInitialRoute("Auth");
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isBooting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingBrand}>T</Text>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Preparing your care companion...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, animation: "fade" }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Auth" component={AuthWrapper} />
        <Stack.Screen
          name="DoctorWorkspace"
          component={DoctorWrapper}
          initialParams={initialUser ? { user: initialUser } : undefined}
        />
        <Stack.Screen
          name="PatientCompanion"
          component={PatientWrapper}
          initialParams={initialUser ? { user: initialUser } : undefined}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 36,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingBrand: {
    color: "#1d4ed8",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
    marginBottom: 8,
  },
  loadingText: {
    color: "#64748b",
    fontSize: 15,
    fontWeight: "600",
  },
});
