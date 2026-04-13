import AsyncStorage from "@react-native-async-storage/async-storage";
import { AI_CONFIG } from "./config";
import type { DoctorPlan } from "./showcase";
import type { BiomarkerReport } from "./biomarker";

export type UserRole = "doctor" | "patient" | "coordinator";

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  language: string;
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

export type BiomarkerRecord = {
  id: string;
  patientEmail: string;
  report: BiomarkerReport;
  timestamp: string;
};

const SESSION_KEY = "tether-session";
const USER_CACHE_KEY = "tether-user-cache";

function apiUrl(path: string): string {
  return `${AI_CONFIG.workerUrl}${path}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  let data: any;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`API error ${res.status}`);
    throw new Error("Invalid response from server");
  }
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as T;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

// ── Session (local only — which user is logged in on this device) ────

export async function getSession(): Promise<UserSession | null> {
  try {
    const value = await AsyncStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as UserSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: UserSession | null): Promise<void> {
  try {
    if (!session) {
      await AsyncStorage.removeItem(SESSION_KEY);
      await AsyncStorage.removeItem(USER_CACHE_KEY);
      return;
    }
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("Failed to save session:", error);
  }
}

export async function getCachedUser(): Promise<UserAccount | null> {
  try {
    const value = await AsyncStorage.getItem(USER_CACHE_KEY);
    return value ? (JSON.parse(value) as UserAccount) : null;
  } catch {
    return null;
  }
}

export async function cacheUser(user: UserAccount): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("Failed to cache user:", error);
  }
}

// ── Auth (server) ────────────────────────────────────────────────────

export async function signup(params: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  language?: string;
}): Promise<UserAccount> {
  return apiFetch<UserAccount>("/api/signup", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function login(email: string, password: string): Promise<UserAccount> {
  return apiFetch<UserAccount>("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ── Plans (server) ───────────────────────────────────────────────────

export async function getPublishedPlans(email?: string): Promise<DoctorPlan[]> {
  const query = email ? `?email=${encodeURIComponent(email)}` : "";
  return apiFetch<DoctorPlan[]>(`/api/plans${query}`);
}

export async function upsertPublishedPlan(plan: DoctorPlan): Promise<void> {
  await apiFetch<{ ok: boolean }>("/api/plans", {
    method: "POST",
    body: JSON.stringify(plan),
  });
}

// ── Messages (server) ────────────────────────────────────────────────

export async function getCareMessages(email?: string): Promise<CareMessage[]> {
  const query = email ? `?email=${encodeURIComponent(email)}` : "";
  return apiFetch<CareMessage[]>(`/api/messages${query}`);
}

export async function addCareMessage(params: {
  doctorEmail: string;
  patientEmail: string;
  senderRole: UserRole;
  senderName: string;
  body: string;
}): Promise<CareMessage> {
  return apiFetch<CareMessage>("/api/messages", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ── Biomarker history (server) ───────────────────────────────────────

export async function getBiomarkerHistory(patientEmail: string): Promise<BiomarkerRecord[]> {
  return apiFetch<BiomarkerRecord[]>(`/api/biomarkers?email=${encodeURIComponent(patientEmail)}`);
}

export async function saveBiomarkerReport(patientEmail: string, report: BiomarkerReport): Promise<BiomarkerRecord> {
  return apiFetch<BiomarkerRecord>("/api/biomarkers", {
    method: "POST",
    body: JSON.stringify({ patientEmail, report }),
  });
}

// ── User settings (server) ───────────────────────────────────────────

export async function setUserLanguage(email: string, language: string): Promise<void> {
  await apiFetch<{ ok: boolean }>("/api/user/language", {
    method: "POST",
    body: JSON.stringify({ email, language }),
  });
}

export async function getUsers(role?: UserRole): Promise<UserAccount[]> {
  const query = role ? `?role=${role}` : "";
  return apiFetch<UserAccount[]>(`/api/users${query}`);
}

// ── Journal (server) ────────────────────────────────────────────────

export type JournalEntry = {
  id: string;
  patientEmail: string;
  text: string;
  createdAt: string;
};

export async function getJournal(patientEmail: string): Promise<JournalEntry[]> {
  return apiFetch<JournalEntry[]>(`/api/journal?email=${encodeURIComponent(patientEmail)}`);
}

export async function addJournalEntry(patientEmail: string, text: string): Promise<JournalEntry> {
  return apiFetch<JournalEntry>("/api/journal", {
    method: "POST",
    body: JSON.stringify({ patientEmail, text }),
  });
}

// ── Medication Adherence (server) ───────────────────────────────────

export type AdherenceRecord = {
  id: string;
  patientEmail: string;
  date: string;
  taken: boolean;
  createdAt: string;
};

export async function getAdherence(patientEmail: string): Promise<AdherenceRecord[]> {
  return apiFetch<AdherenceRecord[]>(`/api/adherence?email=${encodeURIComponent(patientEmail)}`);
}

export async function recordAdherence(patientEmail: string, date: string, taken: boolean): Promise<AdherenceRecord> {
  return apiFetch<AdherenceRecord>("/api/adherence", {
    method: "POST",
    body: JSON.stringify({ patientEmail, date, taken }),
  });
}

// ── Recovery Score (server) ─────────────────────────────────────────

export type RecoveryScoreResult = {
  patientEmail: string;
  patientName: string;
  score: number;
  breakdown: { biomarker: number; adherence: number; engagement: number; journal: number };
  recentAlerts: number;
  daysSinceDischarge: number | null;
};

export async function getRecoveryScores(doctorEmail: string): Promise<RecoveryScoreResult[]> {
  return apiFetch<RecoveryScoreResult[]>(`/api/recovery-score?doctor=${encodeURIComponent(doctorEmail)}`);
}

// ── Draft (local only — doctor's in-progress plan before publishing) ─

const DRAFT_PREFIX = "tether-draft-plan:";

export async function getDoctorDraft(userEmail: string): Promise<DoctorPlan | null> {
  try {
    const value = await AsyncStorage.getItem(`${DRAFT_PREFIX}${normalizeEmail(userEmail)}`);
    return value ? (JSON.parse(value) as DoctorPlan) : null;
  } catch {
    return null;
  }
}

export async function saveDoctorDraft(userEmail: string, plan: DoctorPlan): Promise<void> {
  try {
    await AsyncStorage.setItem(`${DRAFT_PREFIX}${normalizeEmail(userEmail)}`, JSON.stringify(plan));
  } catch (error) {
    console.error("Failed to save draft:", error);
  }
}

export async function clearDoctorDraft(userEmail: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${DRAFT_PREFIX}${normalizeEmail(userEmail)}`);
  } catch (error) {
    console.error("Failed to clear draft:", error);
  }
}

export function buildDoctorStarterDraft(account: UserAccount): DoctorPlan {
  return {
    doctorName: account.name,
    doctorEmail: account.email,
    patientName: "",
    patientEmail: "",
    age: "",
    diagnosis: "",
    symptomSummary: "",
    heartRate: "",
    bloodPressure: "",
    temperature: "",
    oxygenSaturation: "",
    medications: [],
    dailyInstructions: [],
    redFlags: [],
    followUp: "",
    doctorNotes: "",
    tone: "reassuring" as const,
    lastUpdatedAt: new Date().toISOString(),
  };
}

// ── Compat shim: ensureSeedData is now a no-op (server seeds itself) ─

export async function ensureSeedData(): Promise<void> {
  // Server seeds its own data on first load — nothing to do client-side
}
