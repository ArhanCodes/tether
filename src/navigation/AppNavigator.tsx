import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScrollCtx, useScreenScroll, type ScrollContextValue } from "../lib/ScrollContext";
export { useScreenScroll } from "../lib/ScrollContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import {
  getSession,
  getCachedUser,
  cacheUser,
  fetchMe,
  type UserAccount,
} from "../lib/appData";
import { LanguageProvider, useLanguage } from "../lib/LanguageContext";
import { t } from "../lib/i18n";
import type { RootStackParamList } from "../lib/navigationTypes";
import { OnboardingScreen, ONBOARDING_KEY } from "../screens/OnboardingScreen";
import { AuthScreen } from "../screens/AuthScreen";
import { DoctorScreen } from "../screens/DoctorScreen";
import { PatientScreen } from "../screens/PatientScreen";

export type { RootStackParamList } from "../lib/navigationTypes";

const Stack = createNativeStackNavigator<RootStackParamList>();

function ScreenWrapper({ children, stickyFirst, renderFloating }: { children: React.ReactNode; stickyFirst?: boolean; renderFloating?: () => React.ReactNode }) {
  const scrollRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Record<string, number>>({});
  const ctxValue: ScrollContextValue = {
    scrollTo: (y: number) => scrollRef.current?.scrollTo({ y, animated: true }),
    registerSection: (key: string, y: number) => { sectionPositions.current[key] = y; },
    scrollToSection: (key: string) => {
      const y = sectionPositions.current[key];
      if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: true });
    },
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
          {renderFloating ? renderFloating() : null}
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
  const { i } = useLanguage();
  return (
    <ScreenWrapper
      stickyFirst
      renderFloating={() => (
        <FloatingAIButton label={i.talkToAI} />
      )}
    >
      <PatientScreen {...props} />
    </ScreenWrapper>
  );
}

function FloatingAIButton({ label }: { label: string }) {
  const { scrollToSection } = useScreenScroll();
  return (
    <Pressable
      style={styles.floatingAI}
      onPress={() => scrollToSection("ai")}
      accessibilityLabel={label}
    >
      <Text style={styles.floatingAIText}>{label}</Text>
    </Pressable>
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
            const refreshed = await fetchMe(session.userId).catch(() => cachedUser);
            if (refreshed.name !== cachedUser.name || refreshed.language !== cachedUser.language) {
              await cacheUser(refreshed);
            }
            setInitialUser(refreshed);
            if (refreshed.language) setUserLanguage(refreshed.language);
            setInitialRoute(
              refreshed.role === "doctor" ? "DoctorWorkspace" : "PatientCompanion",
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
    backgroundColor: "#F2F2F7",
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 14,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingBrand: {
    color: "#007AFF",
    fontSize: 44,
    fontWeight: "700",
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  loadingText: {
    color: "#8E8E93",
    fontSize: 15,
    fontWeight: "500",
  },
  floatingAI: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: "#007AFF",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  floatingAIText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
