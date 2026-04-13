import { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";

type ResponseType = "action" | "warning" | "medication" | "routine";

const KEY_TERMS = [
  "call for help", "call now", "warning signs",
  "fever", "chest pain", "oxygen level",
  "In short:", "Do not wait", "do not wait",
  "call your doctor", "call your care team",
  "emergency", "urgent",
];

function classifyResponse(text: string): ResponseType {
  const lower = text.toLowerCase();
  if (
    lower.includes("call for help") ||
    lower.includes("call now") ||
    lower.includes("do not wait") ||
    lower.includes("fever") ||
    lower.includes("oxygen level") ||
    lower.includes("chest pain") ||
    lower.includes("emergency") ||
    lower.includes("urgent")
  ) {
    return "warning";
  }
  if (
    lower.includes("medicine") ||
    lower.includes("medication") ||
    lower.includes("amoxicillin") ||
    lower.includes("inhaler") ||
    lower.includes("antibiotic") ||
    lower.includes("take your")
  ) {
    return "medication";
  }
  if (/\d+\./.test(text)) {
    return "action";
  }
  return "routine";
}

function parseSteps(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => /^\d+\./.test(line.trim()))
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function BoldText({ text }: { text: string }) {
  // Build a regex that matches any key term (case-insensitive)
  const escaped = KEY_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <Text style={styles.messageText}>
      {parts.map((part, idx) => {
        const isKey = KEY_TERMS.some((t) => t.toLowerCase() === part.toLowerCase());
        return (
          <Text key={idx} style={isKey ? styles.boldTerm : undefined}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

function ActionChecklist({ steps }: { steps: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(new Array(steps.length).fill(false));

  function toggle(index: number) {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  return (
    <View style={styles.checklist}>
      <Text style={styles.checklistTitle}>Your steps today:</Text>
      {steps.map((step, i) => (
        <Pressable key={i} style={styles.checkItem} onPress={() => toggle(i)}>
          <Text style={[styles.checkBox, checked[i] && styles.checkBoxDone]}>
            {checked[i] ? "\u2713" : "\u25A1"}
          </Text>
          <Text style={[styles.checkText, checked[i] && styles.checkTextDone]}>{step}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function WarningCard() {
  return (
    <View style={styles.warningCard}>
      <Text style={styles.warningIcon}>!</Text>
      <View style={styles.warningContent}>
        <Text style={styles.warningTitle}>Health Alert</Text>
        <Text style={styles.warningText}>
          If you feel worse, call your doctor or 911 right away.
        </Text>
      </View>
    </View>
  );
}

function MedicationScheduleCard() {
  return (
    <View style={styles.medCard}>
      <Text style={styles.medIcon}>Rx</Text>
      <View style={styles.medContent}>
        <Text style={styles.medTitle}>Medication Reminder</Text>
        <Text style={styles.medText}>
          Take your medicines at the same time each day. Set a phone alarm if it helps.
        </Text>
      </View>
    </View>
  );
}

export function AIResponseRenderer({ text }: { text: string }) {
  const type = classifyResponse(text);
  const steps = type === "action" ? parseSteps(text) : [];

  return (
    <View style={styles.wrapper}>
      <BoldText text={text} />
      {type === "warning" ? <WarningCard /> : null}
      {type === "medication" ? <MedicationScheduleCard /> : null}
      {steps.length > 0 ? <ActionChecklist steps={steps} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  messageText: {
    color: "#1e293b",
    fontSize: 15,
    lineHeight: 23,
  },
  boldTerm: {
    fontWeight: "800",
    color: "#0f172a",
  },
  // Checklist
  checklist: {
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  checklistTitle: {
    fontWeight: "800",
    fontSize: 14,
    color: "#166534",
    marginBottom: 2,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkBox: {
    fontSize: 18,
    color: "#166534",
    fontWeight: "700",
    width: 22,
  },
  checkBoxDone: {
    color: "#22c55e",
  },
  checkText: {
    flex: 1,
    fontSize: 14,
    color: "#1e293b",
    lineHeight: 20,
  },
  checkTextDone: {
    textDecorationLine: "line-through",
    color: "#94a3b8",
  },
  // Warning
  warningCard: {
    flexDirection: "row",
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
  },
  warningIcon: {
    fontSize: 20,
    fontWeight: "900",
    color: "#dc2626",
    backgroundColor: "#fee2e2",
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: "center",
    lineHeight: 32,
    overflow: "hidden",
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontWeight: "800",
    fontSize: 14,
    color: "#991b1b",
  },
  warningText: {
    fontSize: 13,
    color: "#7f1d1d",
    lineHeight: 18,
  },
  // Medication
  medCard: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
  },
  medIcon: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: "center",
    lineHeight: 32,
    overflow: "hidden",
  },
  medContent: {
    flex: 1,
  },
  medTitle: {
    fontWeight: "800",
    fontSize: 14,
    color: "#1e40af",
  },
  medText: {
    fontSize: 13,
    color: "#1e3a8a",
    lineHeight: 18,
  },
});
