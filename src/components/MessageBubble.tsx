import { View, Text, StyleSheet } from "react-native";
import type { AssistantUrgency } from "../lib/showcase";

export type ChatMessage = {
  id: string;
  role: "assistant" | "patient";
  text: string;
  urgency?: AssistantUrgency;
  handoffSuggested?: boolean;
};

function urgencyLabel(urgency?: AssistantUrgency): string {
  switch (urgency) {
    case "urgent":
      return "Urgent";
    case "contact-clinician":
      return "Contact Clinician";
    case "routine":
    default:
      return "Routine";
  }
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <View
      style={[
        styles.messageBubble,
        isAssistant ? styles.assistantBubble : styles.patientBubble,
      ]}
    >
      <View style={styles.messageHeader}>
        <Text style={styles.messageRole}>
          {isAssistant ? "Tether AI" : "Patient"}
        </Text>
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
      <Text style={styles.messageText}>{message.text}</Text>
      {message.role === "assistant" && message.handoffSuggested ? (
        <Text style={styles.handoffHint}>
          Not enough certainty for a full answer. Use the doctor messaging box
          below for human follow-up.
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
    backgroundColor: "#e7f4ef",
    borderWidth: 1,
    borderColor: "#c7dfd7",
  },
  patientBubble: {
    backgroundColor: "#f0e5d1",
    borderWidth: 1,
    borderColor: "#e1d0b2",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  messageRole: {
    color: "#10211d",
    fontWeight: "800",
  },
  messageText: {
    marginTop: 8,
    color: "#243631",
    fontSize: 15,
    lineHeight: 23,
  },
  handoffHint: {
    marginTop: 10,
    color: "#7f5c14",
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
    backgroundColor: "#e6b9ae",
  },
  warningBadge: {
    backgroundColor: "#ecd49d",
  },
  routineBadge: {
    backgroundColor: "#cce2d8",
  },
  urgencyText: {
    color: "#10211d",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
