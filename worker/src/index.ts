// @ts-expect-error — wasm import handled by wrangler bundler
import wasmModule from "../wasm/tether_biomarker_bg.wasm";
import { __wbg_set_wasm, analyze_audio, __wbindgen_init_externref_table } from "../wasm/tether_biomarker_bg.js";

// Initialize the WASM module
const instance = new WebAssembly.Instance(wasmModule, {
  "./tether_biomarker_bg.js": { __wbindgen_init_externref_table },
});
__wbg_set_wasm(instance.exports);
__wbindgen_init_externref_table();

// ── Types ────────────────────────────────────────────────────────────

export interface Env {
  GROQ_API_KEY: string;
  TETHER_DATA: DurableObjectNamespace;
}

type UserRole = "doctor" | "patient" | "coordinator";

interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  language: string;
  createdAt: string;
}

interface DoctorPlan {
  doctorName: string;
  doctorEmail: string;
  patientName: string;
  patientEmail: string;
  age: string;
  diagnosis: string;
  symptomSummary: string;
  heartRate: string;
  bloodPressure: string;
  temperature: string;
  oxygenSaturation: string;
  medications: string[];
  dailyInstructions: string[];
  redFlags: string[];
  followUp: string;
  doctorNotes: string;
  tone: "calm" | "direct" | "reassuring";
  lastUpdatedAt: string;
}

interface CareMessage {
  id: string;
  doctorEmail: string;
  patientEmail: string;
  senderRole: UserRole;
  senderName: string;
  body: string;
  createdAt: string;
}

interface BiomarkerRecord {
  id: string;
  patientEmail: string;
  report: {
    energy: number;
    breathing_rate: number;
    pitch_variability: number;
    cough_events: number;
    zero_crossing_rate: number;
    summary: string;
    status: "normal" | "monitor" | "alert";
  };
  timestamp: string;
}

interface TetherState {
  users: UserAccount[];
  plans: DoctorPlan[];
  messages: CareMessage[];
  biomarkers: BiomarkerRecord[];
}

// ── Helpers ──────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function norm(email: string): string {
  return email.trim().toLowerCase();
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Durable Object: TetherData ───────────────────────────────────────

export class TetherData {
  private state: DurableObjectState;
  private data: TetherState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async load(): Promise<TetherState> {
    if (this.data) return this.data;
    const stored = await this.state.storage.get<TetherState>("data");
    if (stored) {
      // Migrate: ensure all users have a language field
      for (const u of stored.users) {
        if (!u.language) u.language = "English";
      }
      if (!stored.biomarkers) stored.biomarkers = [];
      this.data = stored;
      return stored;
    }
    // Seed starter accounts
    const doctorHash = await sha256("password123");
    const patientHash = await sha256("password123");
    const seed: TetherState = {
      users: [
        { id: makeId("doctor"), name: "Dr. Sana Malik", email: "doctor@tether.app", passwordHash: doctorHash, role: "doctor", language: "English", createdAt: new Date().toISOString() },
        { id: makeId("patient"), name: "Ava Thompson", email: "patient@tether.app", passwordHash: patientHash, role: "patient", language: "English", createdAt: new Date().toISOString() },
      ],
      plans: [{
        doctorName: "Dr. Sana Malik", doctorEmail: "doctor@tether.app",
        patientName: "Ava Thompson", patientEmail: "patient@tether.app",
        age: "67", diagnosis: "Post-discharge pneumonia recovery with mild shortness of breath",
        symptomSummary: "Fatigue, mild cough, low appetite, and breathlessness when walking upstairs.",
        heartRate: "96 bpm", bloodPressure: "126/78 mmHg", temperature: "37.4 C", oxygenSaturation: "93%",
        medications: [
          "Amoxicillin 500 mg three times daily for 5 days.",
          "Use the inhaler every morning and evening.",
          "Paracetamol as needed for discomfort, as long as the label directions are followed.",
        ],
        dailyInstructions: [
          "Rest, but still walk around the house a few times during the day.",
          "Drink fluids regularly and eat light meals even if appetite is low.",
          "Check temperature and oxygen level in the morning and evening.",
          "If breathing feels worse than it did at discharge, contact the care team the same day.",
        ],
        redFlags: ["Fever above 38 C", "Oxygen saturation below 92%", "New chest pain", "Severe breathlessness at rest", "Confusion or trouble staying awake"],
        followUp: "Nurse check-in tomorrow morning and GP follow-up appointment in 3 days.",
        doctorNotes: "Explain everything in simple language. Patient becomes anxious when overwhelmed, so keep advice short, calm, and step-based.",
        tone: "reassuring", lastUpdatedAt: new Date().toISOString(),
      }],
      messages: [],
      biomarkers: [],
    };
    this.data = seed;
    await this.save();
    return seed;
  }

  private async save(): Promise<void> {
    await this.state.storage.put("data", this.data);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === "GET") {
        if (path === "/api/plans") return this.getPlans(url);
        if (path === "/api/messages") return this.getMessages(url);
        if (path === "/api/biomarkers") return this.getBiomarkers(url);
        if (path === "/api/users") return this.getUsers(url);
      }
      if (request.method === "POST") {
        if (path === "/api/signup") return this.signup(request);
        if (path === "/api/login") return this.login(request);
        if (path === "/api/plans") return this.upsertPlan(request);
        if (path === "/api/messages") return this.addMessage(request);
        if (path === "/api/biomarkers") return this.addBiomarker(request);
        if (path === "/api/user/language") return this.setLanguage(request);
      }
      return json({ error: "Not found" }, 404);
    } catch (e: any) {
      return json({ error: e.message || "Internal error" }, 500);
    }
  }

  // ── Auth ────────────────────────────────────────────────────────

  private async signup(request: Request): Promise<Response> {
    const body = await request.json() as { name: string; email: string; password: string; role: UserRole; language?: string };
    const data = await this.load();
    const email = norm(body.email);
    if (!email || !body.password || !body.name || !body.role) return json({ error: "Missing fields" }, 400);
    if (data.users.find(u => norm(u.email) === email)) return json({ error: "Account already exists" }, 400);
    const user: UserAccount = {
      id: makeId(body.role),
      name: body.name.trim(),
      email,
      passwordHash: await sha256(body.password),
      role: body.role,
      language: body.language || "English",
      createdAt: new Date().toISOString(),
    };
    data.users.push(user);
    await this.save();
    return json({ id: user.id, name: user.name, email: user.email, role: user.role, language: user.language });
  }

  private async login(request: Request): Promise<Response> {
    const body = await request.json() as { email: string; password: string };
    const data = await this.load();
    const email = norm(body.email);
    const hash = await sha256(body.password);
    const user = data.users.find(u => norm(u.email) === email && u.passwordHash === hash);
    if (!user) return json({ error: "Invalid email or password" }, 401);
    return json({ id: user.id, name: user.name, email: user.email, role: user.role, language: user.language });
  }

  // ── Plans ──────────────────────────────────────────────────────

  private async getPlans(url: URL): Promise<Response> {
    const data = await this.load();
    const email = url.searchParams.get("email");
    if (email) {
      const e = norm(email);
      const filtered = data.plans.filter(p => norm(p.doctorEmail) === e || norm(p.patientEmail) === e);
      return json(filtered);
    }
    return json(data.plans);
  }

  private async upsertPlan(request: Request): Promise<Response> {
    const plan = await request.json() as DoctorPlan;
    const data = await this.load();
    // Validate target patient exists
    const patientExists = data.users.find(u => norm(u.email) === norm(plan.patientEmail));
    if (!patientExists) return json({ error: "Patient account not found" }, 404);
    // Remove old plan from same doctor to same patient
    data.plans = data.plans.filter(p =>
      !(norm(p.doctorEmail) === norm(plan.doctorEmail) && norm(p.patientEmail) === norm(plan.patientEmail))
    );
    plan.lastUpdatedAt = new Date().toISOString();
    data.plans.unshift(plan);
    await this.save();
    return json({ ok: true });
  }

  // ── Messages ───────────────────────────────────────────────────

  private async getMessages(url: URL): Promise<Response> {
    const data = await this.load();
    const doctor = url.searchParams.get("doctor");
    const patient = url.searchParams.get("patient");
    if (doctor && patient) {
      const d = norm(doctor), p = norm(patient);
      return json(data.messages.filter(m => norm(m.doctorEmail) === d && norm(m.patientEmail) === p));
    }
    const email = url.searchParams.get("email");
    if (email) {
      const e = norm(email);
      return json(data.messages.filter(m => norm(m.doctorEmail) === e || norm(m.patientEmail) === e));
    }
    return json(data.messages);
  }

  private async addMessage(request: Request): Promise<Response> {
    const body = await request.json() as { doctorEmail: string; patientEmail: string; senderRole: UserRole; senderName: string; body: string };
    const data = await this.load();
    const msg: CareMessage = {
      id: makeId("msg"),
      doctorEmail: norm(body.doctorEmail),
      patientEmail: norm(body.patientEmail),
      senderRole: body.senderRole,
      senderName: body.senderName,
      body: body.body.trim(),
      createdAt: new Date().toISOString(),
    };
    data.messages.push(msg);
    await this.save();
    return json(msg);
  }

  // ── Biomarkers ─────────────────────────────────────────────────

  private async getBiomarkers(url: URL): Promise<Response> {
    const data = await this.load();
    const email = url.searchParams.get("email");
    if (!email) return json({ error: "email required" }, 400);
    const e = norm(email);
    const records = data.biomarkers.filter(b => norm(b.patientEmail) === e);
    // Return most recent 30
    return json(records.slice(-30));
  }

  private async addBiomarker(request: Request): Promise<Response> {
    const body = await request.json() as { patientEmail: string; report: BiomarkerRecord["report"] };
    const data = await this.load();
    const record: BiomarkerRecord = {
      id: makeId("bio"),
      patientEmail: norm(body.patientEmail),
      report: body.report,
      timestamp: new Date().toISOString(),
    };
    data.biomarkers.push(record);
    // Keep max 200 per patient to prevent unbounded growth
    const e = norm(body.patientEmail);
    const patientRecords = data.biomarkers.filter(b => norm(b.patientEmail) === e);
    if (patientRecords.length > 200) {
      const cutoff = patientRecords[patientRecords.length - 200].timestamp;
      data.biomarkers = data.biomarkers.filter(b => norm(b.patientEmail) !== e || b.timestamp >= cutoff);
    }
    await this.save();
    return json(record);
  }

  // ── Users ──────────────────────────────────────────────────────

  private async getUsers(url: URL): Promise<Response> {
    const data = await this.load();
    const role = url.searchParams.get("role");
    let users = data.users;
    if (role) users = users.filter(u => u.role === role);
    // Never expose password hashes
    return json(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, language: u.language })));
  }

  private async setLanguage(request: Request): Promise<Response> {
    const body = await request.json() as { email: string; language: string };
    const data = await this.load();
    const user = data.users.find(u => norm(u.email) === norm(body.email));
    if (!user) return json({ error: "User not found" }, 404);
    user.language = body.language;
    await this.save();
    return json({ ok: true });
  }
}

// ── Chat handler (Groq proxy) ────────────────────────────────────────

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    systemPrompt: string;
    userMessage: string;
    model?: string;
    maxTokens?: number;
  };

  if (!body.systemPrompt || !body.userMessage) {
    return json({ error: "Missing systemPrompt or userMessage" }, 400);
  }

  const groqResponse = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: body.model ?? "llama-3.3-70b-versatile",
        max_tokens: body.maxTokens ?? 512,
        messages: [
          { role: "system", content: body.systemPrompt },
          { role: "user", content: body.userMessage },
        ],
      }),
    },
  );

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    return json({ error: `Groq API error (${groqResponse.status})`, details: errorText }, 502);
  }

  const data = await groqResponse.json();
  return json(data);
}

// ── Analyze handler (WASM biomarker) ─────────────────────────────────

async function handleAnalyze(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    samples: number[];
    sampleRate: number;
  };

  if (!body.samples || !body.sampleRate) {
    return json({ error: "Missing samples or sampleRate" }, 400);
  }

  const samples = new Int16Array(body.samples);
  const resultJson = analyze_audio(samples, body.sampleRate);
  const report = JSON.parse(resultJson);

  return json(report);
}

// ── Worker entry ─────────────────────────────────────────────────────

function getDataStub(env: Env): DurableObjectStub {
  const id = env.TETHER_DATA.idFromName("main");
  return env.TETHER_DATA.get(id);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const { pathname } = url;

    try {
      // Existing endpoints (no DO needed)
      if (request.method === "POST" && pathname === "/chat") {
        return await handleChat(request, env);
      }
      if (request.method === "POST" && pathname === "/analyze") {
        return await handleAnalyze(request);
      }

      // Data API endpoints — forward to Durable Object
      if (pathname.startsWith("/api/")) {
        const stub = getDataStub(env);
        return stub.fetch(request);
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: "Internal server error" }, 500);
    }
  },
};
