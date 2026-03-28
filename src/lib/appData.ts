import AsyncStorage from "@react-native-async-storage/async-storage";

import { hashPassword, verifyPassword } from "./crypto";
import { demoDoctorPlan, type DoctorPlan } from "./showcase";

export type UserRole = "doctor" | "patient";

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  password: string; // SHA-256 hash
  role: UserRole;
  createdAt: string;
};

export type UserSession = {
  userId: string;
};

export type CareMessage = {
  id: string;
  doctorEmail: string;
  patientEmail: string;
  senderRole: UserRole;
  senderName: string;
  body: string;
  createdAt: string;
};

export const storageKeys = {
  users: "tether-users",
  session: "tether-session",
  plans: "tether-published-plans",
  draftPrefix: "tether-draft-plan:",
  careMessages: "tether-care-messages",
} as const;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function createStarterAccounts(): Promise<UserAccount[]> {
  return [
    {
      id: makeId("doctor"),
      name: "Dr. Sana Malik",
      email: "doctor@tether.app",
      password: await hashPassword("password123"),
      role: "doctor",
      createdAt: new Date().toISOString(),
    },
    {
      id: makeId("patient"),
      name: "Ava Thompson",
      email: "patient@tether.app",
      password: await hashPassword("password123"),
      role: "patient",
      createdAt: new Date().toISOString(),
    },
  ];
}

export function createStarterPlans(): DoctorPlan[] {
  return [
    {
      ...demoDoctorPlan,
      doctorEmail: "doctor@tether.app",
      patientEmail: "patient@tether.app",
    },
  ];
}

export async function ensureSeedData(): Promise<void> {
  try {
    const [usersValue, plansValue, messagesValue] = await Promise.all([
      AsyncStorage.getItem(storageKeys.users),
      AsyncStorage.getItem(storageKeys.plans),
      AsyncStorage.getItem(storageKeys.careMessages),
    ]);

    if (!usersValue) {
      const starters = await createStarterAccounts();
      await AsyncStorage.setItem(storageKeys.users, JSON.stringify(starters));
    }

    if (!plansValue) {
      await AsyncStorage.setItem(
        storageKeys.plans,
        JSON.stringify(createStarterPlans()),
      );
    }

    if (!messagesValue) {
      await AsyncStorage.setItem(storageKeys.careMessages, JSON.stringify([]));
    }
  } catch (error) {
    console.error("Failed to seed data:", error);
  }
}

export async function getUsers(): Promise<UserAccount[]> {
  try {
    const value = await AsyncStorage.getItem(storageKeys.users);
    return value ? (JSON.parse(value) as UserAccount[]) : [];
  } catch (error) {
    console.error("Failed to read users:", error);
    return [];
  }
}

export async function saveUsers(users: UserAccount[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKeys.users, JSON.stringify(users));
  } catch (error) {
    console.error("Failed to save users:", error);
  }
}

export async function getSession(): Promise<UserSession | null> {
  try {
    const value = await AsyncStorage.getItem(storageKeys.session);
    return value ? (JSON.parse(value) as UserSession) : null;
  } catch (error) {
    console.error("Failed to read session:", error);
    return null;
  }
}

export async function saveSession(session: UserSession | null): Promise<void> {
  try {
    if (!session) {
      await AsyncStorage.removeItem(storageKeys.session);
      return;
    }
    await AsyncStorage.setItem(storageKeys.session, JSON.stringify(session));
  } catch (error) {
    console.error("Failed to save session:", error);
  }
}

export async function getPublishedPlans(): Promise<DoctorPlan[]> {
  try {
    const value = await AsyncStorage.getItem(storageKeys.plans);
    return value ? (JSON.parse(value) as DoctorPlan[]) : [];
  } catch (error) {
    console.error("Failed to read plans:", error);
    return [];
  }
}

export async function savePublishedPlans(plans: DoctorPlan[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKeys.plans, JSON.stringify(plans));
  } catch (error) {
    console.error("Failed to save plans:", error);
  }
}

export async function getCareMessages(): Promise<CareMessage[]> {
  try {
    const value = await AsyncStorage.getItem(storageKeys.careMessages);
    return value ? (JSON.parse(value) as CareMessage[]) : [];
  } catch (error) {
    console.error("Failed to read care messages:", error);
    return [];
  }
}

export async function saveCareMessages(messages: CareMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKeys.careMessages, JSON.stringify(messages));
  } catch (error) {
    console.error("Failed to save care messages:", error);
  }
}

export async function addCareMessage(params: {
  doctorEmail: string;
  patientEmail: string;
  senderRole: UserRole;
  senderName: string;
  body: string;
}): Promise<CareMessage[]> {
  const current = await getCareMessages();
  const nextMessage: CareMessage = {
    id: makeId("message"),
    doctorEmail: normalizeEmail(params.doctorEmail),
    patientEmail: normalizeEmail(params.patientEmail),
    senderRole: params.senderRole,
    senderName: params.senderName,
    body: params.body.trim(),
    createdAt: new Date().toISOString(),
  };

  const next = [...current, nextMessage];
  await saveCareMessages(next);
  return next;
}

export async function getDoctorDraft(userEmail: string): Promise<DoctorPlan | null> {
  try {
    const value = await AsyncStorage.getItem(
      `${storageKeys.draftPrefix}${normalizeEmail(userEmail)}`,
    );
    return value ? (JSON.parse(value) as DoctorPlan) : null;
  } catch (error) {
    console.error("Failed to read doctor draft:", error);
    return null;
  }
}

export async function saveDoctorDraft(
  userEmail: string,
  plan: DoctorPlan,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${storageKeys.draftPrefix}${normalizeEmail(userEmail)}`,
      JSON.stringify(plan),
    );
  } catch (error) {
    console.error("Failed to save doctor draft:", error);
  }
}

export async function clearDoctorDraft(userEmail: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(
      `${storageKeys.draftPrefix}${normalizeEmail(userEmail)}`,
    );
  } catch (error) {
    console.error("Failed to clear doctor draft:", error);
  }
}

export async function upsertPublishedPlan(plan: DoctorPlan): Promise<DoctorPlan[]> {
  const current = await getPublishedPlans();
  const next = current.filter(
    (item) =>
      !(
        normalizeEmail(item.doctorEmail) === normalizeEmail(plan.doctorEmail) &&
        normalizeEmail(item.patientEmail) === normalizeEmail(plan.patientEmail)
      ),
  );

  next.unshift(plan);
  await savePublishedPlans(next);
  return next;
}

export async function makeAccount(params: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<UserAccount> {
  return {
    id: makeId(params.role),
    name: params.name.trim(),
    email: normalizeEmail(params.email),
    password: await hashPassword(params.password),
    role: params.role,
    createdAt: new Date().toISOString(),
  };
}

export async function authenticateUser(
  users: UserAccount[],
  email: string,
  password: string,
): Promise<UserAccount | null> {
  const normalized = normalizeEmail(email);
  for (const user of users) {
    if (normalizeEmail(user.email) === normalized) {
      const matches = await verifyPassword(password, user.password);
      if (matches) return user;
    }
  }
  return null;
}

export function buildDoctorStarterDraft(account: UserAccount): DoctorPlan {
  return {
    ...demoDoctorPlan,
    doctorName: account.name,
    doctorEmail: account.email,
    patientName: "",
    patientEmail: "",
    lastUpdatedAt: new Date().toISOString(),
  };
}
