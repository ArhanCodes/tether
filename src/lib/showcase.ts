export type DoctorPlan = {
  doctorName: string;
  doctorEmail: string;
  careNavigatorName?: string;
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
  dischargeDate?: string;
};

export type AssistantUrgency = "routine" | "contact-clinician" | "urgent";

export type AssistantReply = {
  message: string;
  urgency: AssistantUrgency;
  supportingPoints: string[];
  handoffSuggested: boolean;
};

export type QuickPromptIntent =
  | "daily-plan"
  | "call-doctor"
  | "medicines"
  | "summary";

export const quickPrompts: Array<{
  label: string;
  intent: QuickPromptIntent;
}> = [
  { label: "What did my doctor tell me to do today?", intent: "daily-plan" },
  { label: "When should I call the doctor?", intent: "call-doctor" },
  { label: "Can you explain my medicines?", intent: "medicines" },
  { label: "Summarize my recovery plan simply.", intent: "summary" },
];

export const demoDoctorPlan: DoctorPlan = {
  doctorName: "Dr. Sana Malik",
  doctorEmail: "doctor@tether.app",
  careNavigatorName: "Maya Chen",
  patientName: "Ava Thompson",
  patientEmail: "patient@tether.app",
  age: "67",
  diagnosis: "Post-discharge pneumonia recovery with mild shortness of breath",
  symptomSummary:
    "Fatigue, mild cough, low appetite, and breathlessness when walking upstairs.",
  heartRate: "96 bpm",
  bloodPressure: "126/78 mmHg",
  temperature: "37.4 C",
  oxygenSaturation: "93%",
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
  redFlags: [
    "Fever above 38 C",
    "Oxygen saturation below 92%",
    "New chest pain",
    "Severe breathlessness at rest",
    "Confusion or trouble staying awake",
  ],
  followUp:
    "Nurse check-in tomorrow morning and GP follow-up appointment in 3 days.",
  doctorNotes:
    "Explain everything in simple language. Patient becomes anxious when overwhelmed, so keep advice short, calm, and step-based.",
  tone: "reassuring",
  lastUpdatedAt: new Date().toISOString(),
  dischargeDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
};

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => hasKeyword(text, keyword));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasKeyword(text: string, keyword: string): boolean {
  const normalizedText = normalize(text);
  const normalizedKeyword = normalize(keyword);

  if (normalizedKeyword.includes(" ")) {
    return normalizedText.includes(normalizedKeyword);
  }

  return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, "i").test(
    normalizedText,
  );
}

function countKeywordMatches(text: string, keywords: string[]): number {
  return keywords.reduce(
    (total, keyword) => total + (hasKeyword(text, keyword) ? 1 : 0),
    0,
  );
}

function findMatchingItems(items: string[], query: string): string[] {
  const words = normalize(query)
    .split(/[^a-z0-9%]+/)
    .filter(Boolean);

  return items.filter((item) => {
    const itemNormalized = normalize(item);
    return words.some((word) => word.length > 3 && itemNormalized.includes(word));
  });
}

function openingForIntent(
  tone: DoctorPlan["tone"],
  intent:
    | "urgent"
    | "medication"
    | "follow-up"
    | "symptom"
    | "summary"
    | "general",
): string {
  const openings = {
    calm: {
      urgent: "Take this seriously and act now.",
      medication: "Here is the medication plan in plain language.",
      "follow-up": "Here is when your doctor wants you to reach out.",
      symptom: "Here is what your doctor wants you to monitor.",
      summary: "Here is the simple version of today's plan.",
      general: "Here is the safest next step from your doctor's plan.",
    },
    direct: {
      urgent: "This matches a red-flag symptom.",
      medication: "These are the medicines your doctor listed.",
      "follow-up": "This is when you should contact the care team.",
      symptom: "These are the symptoms you should watch.",
      summary: "This is your recovery plan in short steps.",
      general: "This is the clearest next step from the plan.",
    },
    reassuring: {
      urgent: "This sounds like something your doctor wanted treated urgently.",
      medication: "Your doctor gave a clear medicine plan.",
      "follow-up": "Your doctor was clear about when to call.",
      symptom: "Your doctor already mapped out what to watch for.",
      summary: "Here is your plan in simple terms.",
      general: "Here is the best answer from the plan your doctor set for you.",
    },
  } as const;

  return openings[tone][intent];
}

export function summarizePlan(plan: DoctorPlan): string {
  return `${plan.doctorName} recorded that ${plan.patientName} is recovering from ${plan.diagnosis}. The main symptoms to monitor are ${plan.symptomSummary.toLowerCase()} Follow-up is ${plan.followUp.toLowerCase()}`;
}

export function generateQuickPromptReply(
  plan: DoctorPlan,
  intent: QuickPromptIntent,
): AssistantReply {
  switch (intent) {
    case "daily-plan":
      return {
        urgency: "routine",
        message: `${openingForIntent(plan.tone, "summary")} Today, your doctor wants you to ${formatList(
          plan.dailyInstructions.slice(0, 3),
        )}. Keep following the plan unless you notice ${formatList(
          plan.redFlags.slice(0, 2),
        )}.`,
        supportingPoints: [
          `Daily plan: ${formatList(plan.dailyInstructions)}`,
          `Follow-up: ${plan.followUp}`,
        ],
        handoffSuggested: false,
      };
    case "call-doctor":
      return {
        urgency: "contact-clinician",
        message: `${openingForIntent(plan.tone, "follow-up")} Call the doctor or care team if you notice ${formatList(
          plan.redFlags.slice(0, 3),
        )}. Your scheduled follow-up is ${plan.followUp}`,
        supportingPoints: [
          `Red flags: ${formatList(plan.redFlags)}`,
          `Follow-up: ${plan.followUp}`,
        ],
        handoffSuggested: true,
      };
    case "medicines":
      return {
        urgency: "routine",
        message: `${openingForIntent(plan.tone, "medication")} You currently have ${formatList(
          plan.medications,
        )} on your plan. Take them exactly as prescribed, and contact the care team if you are unsure about a missed dose.`,
        supportingPoints: [
          `Medication list: ${formatList(plan.medications)}`,
          `Doctor note: ${plan.doctorNotes}`,
        ],
        handoffSuggested: false,
      };
    case "summary":
      return {
        urgency: "routine",
        message: `${openingForIntent(plan.tone, "summary")} You are recovering from ${plan.diagnosis.toLowerCase()}. The main things to remember are ${formatList(
          plan.dailyInstructions.slice(0, 2),
        )}, and you should get help quickly if you notice ${formatList(
          plan.redFlags.slice(0, 2),
        )}.`,
        supportingPoints: [
          `Symptoms: ${plan.symptomSummary}`,
          `Follow-up: ${plan.followUp}`,
        ],
        handoffSuggested: false,
      };
  }
}

export function generateAssistantReply(
  plan: DoctorPlan,
  patientMessage: string,
): AssistantReply {
  const query = normalize(patientMessage);
  const matchedMedicines = findMatchingItems(plan.medications, query);
  const matchedInstructions = findMatchingItems(plan.dailyInstructions, query);
  const matchedFlags = findMatchingItems(plan.redFlags, query);

  const urgentKeywords = [
    "chest pain",
    "can't breathe",
    "cannot breathe",
    "passed out",
    "fainted",
    "confused",
    "blue lips",
    "severe",
    "worse",
    "emergency",
  ];

  const symptomKeywords = [
    "symptom",
    "feel",
    "cough",
    "breathing",
    "breath",
    "fever",
    "oxygen",
    "temperature",
    "pain",
  ];

  const medicationKeywords = [
    "medicine",
    "medicines",
    "medication",
    "medications",
    "tablet",
    "tablets",
    "pill",
    "pills",
    "antibiotic",
    "antibiotics",
    "inhaler",
  ];

  const followUpKeywords = [
    "appointment",
    "follow up",
    "nurse",
    "call",
    "clinic",
    "when should",
  ];

  const summaryKeywords = [
    "summary",
    "summarize",
    "plan",
    "today",
    "what should i do",
    "what do i do",
    "help me understand",
  ];

  const medicationScore =
    countKeywordMatches(query, medicationKeywords) + matchedMedicines.length;
  const followUpScore = countKeywordMatches(query, followUpKeywords);
  const symptomScore =
    countKeywordMatches(query, symptomKeywords) +
    matchedInstructions.length +
    matchedFlags.length;
  const summaryScore = countKeywordMatches(query, summaryKeywords);

  if (containsAny(query, urgentKeywords) || matchedFlags.length > 0) {
    return {
      urgency: "urgent",
      message: `${openingForIntent(plan.tone, "urgent")} Based on ${plan.doctorName}'s instructions, this sounds like a red-flag situation. ${matchedFlags[0] ?? "Your doctor marked worsening symptoms as urgent."} You should contact your care team now, and if symptoms feel severe or unsafe, seek urgent medical help immediately.`,
      supportingPoints: [
        `Doctor red flags: ${formatList(plan.redFlags.slice(0, 3))}.`,
        `Latest doctor-entered vitals: heart rate ${plan.heartRate}, oxygen ${plan.oxygenSaturation}, temperature ${plan.temperature}.`,
        `Follow-up already planned: ${plan.followUp}`,
      ],
      handoffSuggested: true,
    };
  }

  if (medicationScore > 0 && medicationScore >= followUpScore && medicationScore >= symptomScore) {
    const medicines = matchedMedicines.length > 0 ? matchedMedicines : plan.medications;

    return {
      urgency: "routine",
      message: `${openingForIntent(plan.tone, "medication")} ${plan.doctorName} documented these medicines for you: ${formatList(
        medicines,
      )} Take them exactly as prescribed, and if you are unsure whether you missed a dose, call the care team before doubling anything.`,
      supportingPoints: [
        `Doctor's medication list: ${formatList(plan.medications)}`,
        `Extra note: ${plan.doctorNotes}`,
      ],
      handoffSuggested: false,
    };
  }

  if (followUpScore > 0 && followUpScore >= symptomScore) {
    return {
      urgency: "contact-clinician",
      message: `${openingForIntent(plan.tone, "follow-up")} Your follow-up plan is: ${plan.followUp} You should contact the doctor sooner if any red-flag symptoms appear, especially ${formatList(
        plan.redFlags.slice(0, 2),
      )}.`,
      supportingPoints: [
        `Daily actions: ${formatList(plan.dailyInstructions.slice(0, 2))}`,
        `Red flags: ${formatList(plan.redFlags)}`,
      ],
      handoffSuggested: true,
    };
  }

  if (symptomScore > 0) {
    const symptomLine =
      matchedInstructions[0] ??
      `Monitor the symptoms your doctor listed: ${plan.symptomSummary.toLowerCase()}`;

    return {
      urgency: "contact-clinician",
      message: `${openingForIntent(plan.tone, "symptom")} ${symptomLine}. Your doctor wants you to keep an eye on ${plan.symptomSummary.toLowerCase()} If those symptoms worsen or you notice ${formatList(
        plan.redFlags.slice(0, 2),
      )}, contact the care team the same day.`,
      supportingPoints: [
        `Doctor-entered symptoms: ${plan.symptomSummary}`,
        `Important warning signs: ${formatList(plan.redFlags)}`,
      ],
      handoffSuggested: true,
    };
  }

  if (summaryScore > 0 || query.length < 18) {
    return {
      urgency: "routine",
      message: `${openingForIntent(plan.tone, "summary")} You are recovering from ${plan.diagnosis.toLowerCase()}. Today, focus on ${formatList(
        plan.dailyInstructions.slice(0, 3),
      )}. Keep taking ${formatList(
        plan.medications.slice(0, 2),
      )}, and call the care team if you notice ${formatList(plan.redFlags.slice(0, 2))}.`,
      supportingPoints: [
        `Follow-up: ${plan.followUp}`,
        `Doctor note: ${plan.doctorNotes}`,
      ],
      handoffSuggested: false,
    };
  }

  return {
    urgency: "routine",
    message: `${openingForIntent(plan.tone, "general")} From the plan ${plan.doctorName} entered, the safest answer is to follow these steps: ${formatList(
      plan.dailyInstructions.slice(0, 3),
    )}. I may not have enough doctor-provided detail to answer every part of that question exactly, so use the in-app messaging feature if you want a direct reply from your doctor. If you feel worse than expected, contact the care team because your doctor flagged ${formatList(
      plan.redFlags.slice(0, 2),
    )} as important warning signs.`,
    supportingPoints: [
      `Medications on file: ${formatList(plan.medications)}`,
      `Follow-up plan: ${plan.followUp}`,
    ],
    handoffSuggested: true,
  };
}
