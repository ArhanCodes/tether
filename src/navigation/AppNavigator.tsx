import { useEffect, useRef, useState } from "react";
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

import { ScrollCtx, type ScrollContextValue } from "../lib/ScrollContext";
export { useScreenScroll } from "../lib/ScrollContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import {
  getSession,
  getCachedUser,
  type UserAccount,
} from "../lib/appData";
import { LanguageProvider } from "../lib/LanguageContext";
import { t } from "../lib/i18n";
import type { RootStackParamList } from "../lib/navigationTypes";
import { OnboardingScreen, ONBOARDING_KEY } from "../screens/OnboardingScreen";
import { AuthScreen } from "../screens/AuthScreen";
import { DoctorScreen } from "../screens/DoctorScreen";
import { PatientScreen } from "../screens/PatientScreen";

export type { RootStackParamList } from "../lib/navigationTypes";

const Stack = createNativeStackNavigator<RootStackParamList>();

function ScreenWrapper({ children, stickyFirst }: { children: React.ReactNode; stickyFirst?: boolean }) {
  const scrollRef = useRef<ScrollView>(null);
  const ctxValue: ScrollContextValue = {
    scrollTo: (y: number) => scrollRef.current?.scrollTo({ y, animated: true }),
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollCtx.Provider value={ctxValue}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboard}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={stickyFirst ? [0] : undefined}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </ScrollCtx.Provider>
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
    <ScreenWrapper stickyFirst>
      <DoctorScreen {...props} />
    </ScreenWrapper>
  );
}

function PatientWrapper(props: { navigation: any; route: any }) {
  return (
    <ScreenWrapper stickyFirst>
      <PatientScreen {...props} />
    </ScreenWrapper>
  );
}

export function AppNavigator() {
  const [isBooting, setIsBooting] = useState(true);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>("Onboarding");
  const [initialUser, setInitialUser] = useState<UserAccount | null>(null);
  const [userLanguage, setUserLanguage] = useState("English");

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
            if (cachedUser.language) setUserLanguage(cachedUser.language);
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

  const i = t(userLanguage);

  if (isBooting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingBrand}>T</Text>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>{i.loadingText}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LanguageProvider initialLanguage={userLanguage}>
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
    </LanguageProvider>
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
