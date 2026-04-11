import { AI_CONFIG, isAIConfigured } from "./config";
import {
  generateAssistantReply as fallbackReply,
  generateQuickPromptReply as fallbackQuickReply,
  type AssistantReply,
  type DoctorPlan,
  type QuickPromptIntent,
} from "./showcase";
import type { BiomarkerReport } from "./biomarker";
import type { JournalEntry, AdherenceRecord } from "./appData";

export type AIContext = {
  plan: DoctorPlan;
  language?: string;
  latestBiomarker?: BiomarkerReport | null;
  journalEntries?: JournalEntry[];
  adherenceRecords?: AdherenceRecord[];
};

const AI_TIMEOUT_MS = 30_000;

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = AI_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function buildSystemPrompt(ctx: AIContext): string {
  const { plan, language, latestBiomarker, journalEntries, adherenceRecords } = ctx;
  const lang = language && language !== "English" ? language : null;

  let prompt = `You are Tether AI, a clinical companion assistant for post-discharge patients. You answer questions based ONLY on the care plan the patient's doctor published. Never diagnose, prescribe, or give advice beyond what the doctor documented.

DOCTOR'S CARE PLAN:
- Doctor: ${plan.doctorName}
- Patient: ${plan.patientName} (age ${plan.age})
- Diagnosis: ${plan.diagnosis}
- Symptoms: ${plan.symptomSummary}
- Vitals: HR ${plan.heartRate}, BP ${plan.bloodPressure}, Temp ${plan.temperature}, O2 ${plan.oxygenSaturation}
- Medications: ${plan.medications.join("; ")}
- Daily instructions: ${plan.dailyInstructions.join("; ")}
- Red flags (contact care team immediately): ${plan.redFlags.join("; ")}
- Follow-up: ${plan.followUp}
- Doctor's note on tone: ${plan.doctorNotes}
- Preferred tone: ${plan.tone}`;

  // Time-aware prompting: days since discharge
  if (plan.dischargeDate) {
    const dischargeDays = Math.floor((Date.now() - new Date(plan.dischargeDate).getTime()) / (1000 * 60 * 60 * 24));
    prompt += `\n- Days since discharge: ${dischargeDays}`;
    if (dischargeDays <= 3) {
      prompt += ` (EARLY recovery — be extra cautious, encourage rest and monitoring)`;
    } else if (dischargeDays <= 14) {
      prompt += ` (MID recovery — encourage gradual activity and adherence)`;
    } else {
      prompt += ` (EXTENDED recovery — focus on long-term habits and follow-up)`;
    }
  }

  // Medication adherence context
  if (adherenceRecords && adherenceRecords.length > 0) {
    const last7 = adherenceRecords.slice(-7);
    const taken = last7.filter(r => r.taken).length;
    const missed = last7.length - taken;
    prompt += `\n\nMEDICATION ADHERENCE (last 7 days): ${taken} taken, ${missed} missed out of ${last7.length} logged days.`;
    if (missed > 2) {
      prompt += ` The patient has missed medications frequently — gently remind them about the importance of taking medicines as prescribed.`;
    }
  }

  // Journal context — recent entries for emotional/symptom awareness
  if (journalEntries && journalEntries.length > 0) {
    const recent = journalEntries.slice(-3);
    const journalText = recent.map(e => `[${e.createdAt.split("T")[0]}] ${e.text}`).join("\n");
    prompt += `\n\nRECENT PATIENT JOURNAL ENTRIES:\n${journalText}\n\nUse journal entries to understand the patient's emotional state and symptoms. If they mention worsening symptoms or distress, factor that into your urgency assessment.`;
  }

  // Inject latest biomarker data if available (engine connection)
  if (latestBiomarker) {
    prompt += `

LATEST VOICE BIOMARKER ANALYSIS:
- Voice Energy: ${latestBiomarker.energy} (low values suggest fatigue)
- Breathing Rate: ${latestBiomarker.breathing_rate}/min (normal: 12-20)
- Pitch Variability: ${latestBiomarker.pitch_variability} (high values may indicate tremor)
- Cough Events: ${latestBiomarker.cough_events}
- Zero-Crossing Rate: ${latestBiomarker.zero_crossing_rate} (high = breathy/labored speech)
- Analysis Confidence: ${latestBiomarker.confidence} (0-1 scale, based on recording quality)
- Status: ${latestBiomarker.status.toUpperCase()}
- Summary: ${latestBiomarker.summary}

When the patient asks about their health or how they're doing, incorporate relevant biomarker findings into your response. If biomarker status is "alert", proactively mention the concerning findings and recommend contacting the care team.`;
  }

  prompt += `

RULES:
1. Only reference information from the care plan above.
2. If the patient describes a red-flag symptom, set urgency to "urgent" and tell them to contact their care team immediately.
3. If you cannot answer from the plan, say so and suggest messaging the doctor directly.
4. Keep responses short, ${plan.tone}, and easy to understand at a 5th grade reading level.
5. Always respond with valid JSON matching this schema:
{
  "message": "string - your response to the patient",
  "urgency": "routine" | "contact-clinician" | "urgent",
  "supportingPoints": ["string array of 1-3 supporting details from the plan"],
  "handoffSuggested": boolean
}`;

  if (lang) {
    prompt += `
6. IMPORTANT: Respond in ${lang}. The patient's preferred language is ${lang}. All text in the "message" field must be in ${lang}. Keep it simple — 5th grade reading level in ${lang}.`;
  }

  return prompt;
}

function parseAIResponse(text: string): AssistantReply {
  // Use non-greedy match to avoid spanning across multiple JSON objects
  const jsonMatch = text.match(/\{[\s\S]*?\}(?=[^}]*$)/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // If no JSON found, treat the entire text as the message
    return { message: text.trim(), urgency: "routine", supportingPoints: [], handoffSuggested: false };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const message = typeof parsed.message === "string" && parsed.message.trim()
      ? parsed.message
      : text.trim();
    const validUrgencies = ["routine", "contact-clinician", "urgent"];
    return {
      message,
      urgency: validUrgencies.includes(parsed.urgency) ? parsed.urgency : "routine",
      supportingPoints: Array.isArray(parsed.supportingPoints) ? parsed.supportingPoints : [],
      handoffSuggested: typeof parsed.handoffSuggested === "boolean" ? parsed.handoffSuggested : false,
    };
  } catch {
    // JSON parse failed — use raw text as message
    return { message: text.trim(), urgency: "routine", supportingPoints: [], handoffSuggested: false };
  }
}

async function callViaWorker(
  systemPrompt: string,
  userMessage: string,
): Promise<AssistantReply> {
  const response = await fetchWithTimeout(`${AI_CONFIG.workerUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt,
      userMessage,
      model: AI_CONFIG.model,
      maxTokens: AI_CONFIG.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Worker error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from worker");
  }

  return parseAIResponse(text);
}

async function callGroqDirect(
  systemPrompt: string,
  userMessage: string,
): Promise<AssistantReply> {
  const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      max_tokens: AI_CONFIG.maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from Groq API");
  }

  return parseAIResponse(text);
}

async function callAI(
  systemPrompt: string,
  userMessage: string,
): Promise<AssistantReply> {
  if (AI_CONFIG.workerUrl) {
    return callViaWorker(systemPrompt, userMessage);
  }
  return callGroqDirect(systemPrompt, userMessage);
}

export async function generateAIReply(
  ctx: AIContext,
  patientMessage: string,
): Promise<AssistantReply> {
  if (!isAIConfigured()) {
    return fallbackReply(ctx.plan, patientMessage);
  }

  try {
    const systemPrompt = buildSystemPrompt(ctx);
    return await callAI(systemPrompt, patientMessage);
  } catch {
    return fallbackReply(ctx.plan, patientMessage);
  }
}

export async function generateAIQuickReply(
  ctx: AIContext,
  label: string,
  intent: QuickPromptIntent,
): Promise<AssistantReply> {
  if (!isAIConfigured()) {
    return fallbackQuickReply(ctx.plan, intent);
  }

  try {
    const systemPrompt = buildSystemPrompt(ctx);
    return await callAI(systemPrompt, label);
  } catch {
    return fallbackQuickReply(ctx.plan, intent);
  }
}
