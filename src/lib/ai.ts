import { AI_CONFIG, isAIConfigured } from "./config";
import {
  generateAssistantReply as fallbackReply,
  generateQuickPromptReply as fallbackQuickReply,
  type AssistantReply,
  type DoctorPlan,
  type QuickPromptIntent,
} from "./showcase";

function buildSystemPrompt(plan: DoctorPlan): string {
  return `You are Tether AI, a clinical companion assistant for post-discharge patients. You answer questions based ONLY on the care plan the patient's doctor published. Never diagnose, prescribe, or give advice beyond what the doctor documented.

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
- Preferred tone: ${plan.tone}

RULES:
1. Only reference information from the care plan above.
2. If the patient describes a red-flag symptom, set urgency to "urgent" and tell them to contact their care team immediately.
3. If you cannot answer from the plan, say so and suggest messaging the doctor directly.
4. Keep responses short, ${plan.tone}, and easy to understand.
5. Always respond with valid JSON matching this schema:
{
  "message": "string - your response to the patient",
  "urgency": "routine" | "contact-clinician" | "urgent",
  "supportingPoints": ["string array of 1-3 supporting details from the plan"],
  "handoffSuggested": boolean
}`;
}

async function callClaudeAPI(
  systemPrompt: string,
  userMessage: string,
): Promise<AssistantReply> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": AI_CONFIG.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      max_tokens: AI_CONFIG.maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error("Empty response from Claude API");
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from Claude response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as AssistantReply;
  return {
    message: parsed.message,
    urgency: parsed.urgency ?? "routine",
    supportingPoints: parsed.supportingPoints ?? [],
    handoffSuggested: parsed.handoffSuggested ?? false,
  };
}

export async function generateAIReply(
  plan: DoctorPlan,
  patientMessage: string,
): Promise<AssistantReply> {
  if (!isAIConfigured()) {
    return fallbackReply(plan, patientMessage);
  }

  try {
    const systemPrompt = buildSystemPrompt(plan);
    return await callClaudeAPI(systemPrompt, patientMessage);
  } catch {
    return fallbackReply(plan, patientMessage);
  }
}

export async function generateAIQuickReply(
  plan: DoctorPlan,
  label: string,
  intent: QuickPromptIntent,
): Promise<AssistantReply> {
  if (!isAIConfigured()) {
    return fallbackQuickReply(plan, intent);
  }

  try {
    const systemPrompt = buildSystemPrompt(plan);
    return await callClaudeAPI(systemPrompt, label);
  } catch {
    return fallbackQuickReply(plan, intent);
  }
}
