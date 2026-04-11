import { View, Text, StyleSheet } from "react-native";
import type { AssistantUrgency } from "../lib/showcase";
import { fleschKincaidGradeLevel, readabilityLabel } from "../lib/readability";
import { useLanguage } from "../lib/LanguageContext";

export type ChatMessage = {
  id: string;
  role: "assistant" | "patient";
  text: string;
  urgency?: AssistantUrgency;
  handoffSuggested?: boolean;
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { i } = useLanguage();
  const isAssistant = message.role === "assistant";

  function urgencyLabel(urgency?: AssistantUrgency): string {
    switch (urgency) {
      case "urgent":
        return i.urgent;
      case "contact-clinician":
        return i.contactClinician;
      case "routine":
      default:
        return i.routine;
    }
  }
  const grade = isAssistant ? fleschKincaidGradeLevel(message.text) : null;
  const gradeLabel = grade !== null ? readabilityLabel(grade) : null;

  return (
    <View
      style={[
        styles.messageBubble,
        isAssistant ? styles.assistantBubble : styles.patientBubble,
      ]}
    >
      <View style={styles.messageHeader}>
        <Text style={styles.messageRole}>
          {isAssistant ? i.tetherAI : i.patient}
        </Text>
        <View style={styles.badgeRow}>
          {isAssistant && grade !== null ? (
            <View style={[styles.readabilityBadge, grade <= 6 ? styles.readabilityGood : grade <= 10 ? styles.readabilityOk : styles.readabilityHigh]}>
              <Text style={styles.readabilityText}>
                {i.grade} {grade} · {gradeLabel}
              </Text>
            </View>
          ) : null}
          {isAssistant ? (
            <View
              style={[
                styles.urgencyBadge,
                message.urgency === "urgent"
                  ? styles.urgentBadge
                  : message.urgency === "contact-clinician"
                    ? styles.warningBadge
                    : styles.routineBadge,
              ]}
            >
              <Text style={styles.urgencyText}>{urgencyLabel(message.urgency)}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.messageText}>{message.text}</Text>
      {message.role === "assistant" && message.handoffSuggested ? (
        <Text style={styles.handoffHint}>
          {i.handoffHint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  messageBubble: {
    padding: 14,
    borderRadius: 18,
  },
  assistantBubble: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  patientBubble: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  messageRole: {
    color: "#0f172a",
    fontWeight: "800",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  messageText: {
    marginTop: 8,
    color: "#334155",
    fontSize: 15,
    lineHeight: 23,
  },
  handoffHint: {
    marginTop: 10,
    color: "#92400e",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  urgentBadge: {
    backgroundColor: "#fee2e2",
  },
  warningBadge: {
    backgroundColor: "#fef3c7",
  },
  routineBadge: {
    backgroundColor: "#dbeafe",
  },
  urgencyText: {
    color: "#0f172a",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  readabilityGood: {
    backgroundColor: "#dcfce7",
  },
  readabilityOk: {
    backgroundColor: "#fef3c7",
  },
  readabilityHigh: {
    backgroundColor: "#fee2e2",
  },
  readabilityText: {
    color: "#0f172a",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
