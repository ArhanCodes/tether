import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { MessageBubble, type ChatMessage } from "../components/MessageBubble";
import { SectionCard } from "../components/SectionCard";
import { SummaryPill } from "../components/SummaryPill";
import {
  addCareMessage,
  getCareMessages,
  getPublishedPlans,
  normalizeEmail,
  saveSession,
  type CareMessage,
} from "../lib/appData";
import { quickPrompts, type DoctorPlan, type QuickPromptIntent } from "../lib/showcase";
import { generateAIReply, generateAIQuickReply } from "../lib/ai";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "PatientCompanion">;

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function createGreeting(plan: DoctorPlan): ChatMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    urgency: "routine",
    text: `Hi ${plan.patientName}. I can explain the care plan ${plan.doctorName} entered for you. Ask me what to do today, when to call the doctor, or what your medicines are for.`,
  };
}

export function PatientScreen({ navigation, route }: Props) {
  const { user } = route.params;

  const [activePlan, setActivePlan] = useState<DoctorPlan | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [careMessages, setCareMessages] = useState<CareMessage[]>([]);
  const [patientInput, setPatientInput] = useState("");
  const [careMessageInput, setCareMessageInput] = useState("");
  const [audioRepliesEnabled, setAudioRepliesEnabled] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const finalVoiceTranscriptRef = useRef("");

  useEffect(() => {
    void (async () => {
      try {
        const [plans, msgs] = await Promise.all([
          getPublishedPlans(),
          getCareMessages(),
        ]);
        setCareMessages(msgs);

        const plan =
          plans.find(
            (p) => normalizeEmail(p.patientEmail) === normalizeEmail(user.email),
          ) ?? null;
        setActivePlan(plan);

        if (plan) {
          setMessages([createGreeting(plan)]);
        }

        try {
          setVoiceSupported(ExpoSpeechRecognitionModule.isRecognitionAvailable());
        } catch {
          setVoiceSupported(false);
        }
      } catch (error) {
        console.error("Failed to load patient data:", error);
      }
    })();

    return () => {
      Speech.stop();
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Safe no-op
      }
    };
  }, [user]);

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setVoiceError(null);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setLiveTranscript("");
    const transcript = finalVoiceTranscriptRef.current.trim();
    finalVoiceTranscriptRef.current = "";
    if (transcript) {
      void submitPatientMessage(transcript);
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results.map((item) => item.transcript).join(" ").trim();
    setLiveTranscript(transcript);
    if (event.isFinal && transcript) {
      finalVoiceTranscriptRef.current = transcript;
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    setLiveTranscript("");
    setVoiceError(event.message || event.error);
  });

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant") ?? null,
    [messages],
  );

  const patientConversation = useMemo(() => {
    if (!activePlan) return [];
    return careMessages.filter(
      (msg) =>
        normalizeEmail(msg.doctorEmail) === normalizeEmail(activePlan.doctorEmail) &&
        normalizeEmail(msg.patientEmail) === normalizeEmail(activePlan.patientEmail),
    );
  }, [activePlan, careMessages]);

  async function submitPatientMessage(rawMessage?: string) {
    if (!activePlan) return;
    const message = (rawMessage ?? patientInput).trim();
    if (!message) return;

    const patientMsg: ChatMessage = {
      id: `patient-${Date.now()}`,
      role: "patient",
      text: message,
    };

    setMessages((cur) => [...cur, patientMsg]);
    setPatientInput("");
    setIsThinking(true);

    try {
      const reply = await generateAIReply(activePlan, message);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: reply.message,
        urgency: reply.urgency,
        handoffSuggested: reply.handoffSuggested,
      };
      setMessages((cur) => [...cur, assistantMsg]);

      if (audioRepliesEnabled) {
        Speech.stop();
        Speech.speak(reply.message, { language: "en-US", pitch: 1, rate: 0.96 });
      }
    } catch (error) {
      console.error("AI reply error:", error);
      setMessages((cur) => [
        ...cur,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "Sorry, I had trouble generating a response. Please try again or message your doctor directly.",
          urgency: "routine",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  async function sendQuickPrompt(label: string, intent: QuickPromptIntent) {
    if (!activePlan) return;

    const patientMsg: ChatMessage = {
      id: `patient-${Date.now()}`,
      role: "patient",
      text: label,
    };

    setMessages((cur) => [...cur, patientMsg]);
    setIsThinking(true);

    try {
      const reply = await generateAIQuickReply(activePlan, label, intent);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: reply.message,
        urgency: reply.urgency,
        handoffSuggested: reply.handoffSuggested,
      };
      setMessages((cur) => [...cur, assistantMsg]);

      if (audioRepliesEnabled) {
        Speech.stop();
        Speech.speak(reply.message, { language: "en-US", pitch: 1, rate: 0.96 });
      }
    } catch (error) {
      console.error("Quick prompt error:", error);
    } finally {
      setIsThinking(false);
    }
  }

  async function handleVoiceToggle() {
    if (!activePlan) return;

    if (!voiceSupported) {
      Alert.alert(
        "Voice unavailable",
        "Speech recognition is not currently available on this device or simulator.",
      );
      return;
    }

    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceError("Microphone or speech permissions were not granted.");
        return;
      }

      finalVoiceTranscriptRef.current = "";
      setLiveTranscript("");
      setVoiceError(null);

      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
      });
    } catch (error) {
      setVoiceError("Failed to start voice recognition.");
      console.error("Voice toggle error:", error);
    }
  }

  async function sendMessageToDoctor(prefill?: string) {
    if (!activePlan) return;
    const body = (prefill ?? careMessageInput).trim();
    if (!body) return;

    try {
      const nextMessages = await addCareMessage({
        doctorEmail: activePlan.doctorEmail,
        patientEmail: activePlan.patientEmail,
        senderRole: "patient",
        senderName: user.name,
        body,
      });
      setCareMessages(nextMessages);
      setCareMessageInput("");
      Alert.alert("Sent", `Your message was sent to ${activePlan.doctorName}.`);
    } catch (error) {
      Alert.alert("Error", "Failed to send message. Please try again.");
      console.error("Send message error:", error);
    }
  }

  async function handleLogout() {
    await saveSession(null);
    Speech.stop();
    navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
  }

  return (
    <>
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>Patient Companion</Text>
        <Text style={styles.heroTitle}>{user.name}</Text>
        <Text style={styles.heroText}>
          Logged in as {user.email}. Your app only shows plans that were published to your patient email.
        </Text>
        <Text style={styles.heroSubtext}>
          If symptoms feel severe, new, or unsafe, seek urgent medical help and do not wait for chat responses.
        </Text>
        <Pressable style={styles.secondaryButton} onPress={() => void handleLogout()}>
          <Text style={styles.secondaryButtonText}>Log Out</Text>
        </Pressable>
      </View>

      {!activePlan ? (
        <SectionCard
          title="No Plan Assigned Yet"
          subtitle="Ask your doctor to publish a plan to your patient email address."
        >
          <Text style={styles.previewText}>
            No published recovery plan matches {user.email} yet. Once a doctor publishes one to this email, it will appear here.
          </Text>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title={`${activePlan.patientName}'s Recovery Plan`}
            subtitle={`Published by ${activePlan.doctorName} on ${formatTimestamp(activePlan.lastUpdatedAt)}`}
          >
            <View style={styles.escalationBanner}>
              <Text style={styles.escalationBannerText}>
                Emergency symptoms should never wait for an AI or message reply. If you feel unsafe, seek immediate medical help.
              </Text>
            </View>

            <View style={styles.previewGrid}>
              <SummaryPill label="Heart Rate" value={activePlan.heartRate} />
              <SummaryPill label="Blood Pressure" value={activePlan.bloodPressure} />
              <SummaryPill label="Temperature" value={activePlan.temperature} />
              <SummaryPill label="Oxygen" value={activePlan.oxygenSaturation} />
            </View>

            <View style={styles.listCard}>
              <Text style={styles.listTitle}>What to do today</Text>
              {activePlan.dailyInstructions.map((item) => (
                <Text key={item} style={styles.listItem}>• {item}</Text>
              ))}
            </View>

            <View style={styles.listCard}>
              <Text style={styles.listTitle}>Call for help if you notice</Text>
              {activePlan.redFlags.map((item) => (
                <Text key={item} style={styles.listItem}>• {item}</Text>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Ask Tether AI" subtitle="Voice and text answers are based on the doctor's published plan.">
            <View style={styles.voiceStatusRow}>
              <View style={[styles.statusDot, voiceSupported ? styles.statusGood : styles.statusMuted]} />
              <Text style={styles.voiceStatusText}>
                {voiceSupported ? "Voice recognition available" : "Voice recognition unavailable on this device"}
              </Text>
              <Pressable
                onPress={() => setAudioRepliesEnabled((v) => !v)}
                style={[styles.audioToggle, audioRepliesEnabled && styles.audioToggleActive]}
              >
                <Text style={[styles.audioToggleText, audioRepliesEnabled && styles.audioToggleTextActive]}>
                  {audioRepliesEnabled ? "Voice Reply On" : "Voice Reply Off"}
                </Text>
              </Pressable>
            </View>

            {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}

            {liveTranscript ? (
              <View style={styles.transcriptCard}>
                <Text style={styles.transcriptLabel}>Listening</Text>
                <Text style={styles.transcriptText}>{liveTranscript}</Text>
              </View>
            ) : null}

            <ScrollView
              style={styles.chatLog}
              contentContainerStyle={styles.chatLogContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isThinking ? (
                <View style={styles.thinkingBubble}>
                  <Text style={styles.thinkingText}>Thinking...</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.promptWrap}>
              {quickPrompts.map((prompt) => (
                <Pressable
                  key={prompt.label}
                  style={styles.promptChip}
                  onPress={() => void sendQuickPrompt(prompt.label, prompt.intent)}
                >
                  <Text style={styles.promptChipText}>{prompt.label}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={patientInput}
              onChangeText={setPatientInput}
              placeholder="Type the patient's question..."
              placeholderTextColor="#7b8f88"
              style={styles.chatInput}
              multiline
            />

            <View style={styles.buttonRow}>
              <Pressable style={styles.primaryButton} onPress={() => void submitPatientMessage()}>
                <Text style={styles.primaryButtonText}>Send to AI</Text>
              </Pressable>
              <Pressable
                style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
                onPress={() => void handleVoiceToggle()}
              >
                <Text style={[styles.voiceButtonText, isListening && styles.voiceButtonTextActive]}>
                  {isListening ? "Stop Listening" : "Start Voice Chat"}
                </Text>
              </Pressable>
            </View>
          </SectionCard>

          <SectionCard
            title={`Message ${activePlan.doctorName}`}
            subtitle="Use this when you want a human answer or the AI tells you it may not have enough information."
          >
            {latestAssistantMessage?.handoffSuggested ? (
              <View style={styles.escalationBanner}>
                <Text style={styles.escalationBannerText}>
                  Tether AI recommends messaging your doctor for this situation.
                </Text>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    void sendMessageToDoctor(
                      `Hi ${activePlan.doctorName}, I need help with: ${patientInput || "my current symptoms and recovery plan."}`,
                    )
                  }
                >
                  <Text style={styles.secondaryButtonText}>Send Quick Help Request</Text>
                </Pressable>
              </View>
            ) : null}

            <ScrollView
              style={styles.chatLog}
              contentContainerStyle={styles.chatLogContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {patientConversation.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    msg.senderRole === "doctor" ? styles.assistantBubble : styles.patientBubble,
                  ]}
                >
                  <View style={styles.messageHeader}>
                    <Text style={styles.messageRole}>{msg.senderName}</Text>
                    <Text style={styles.threadTime}>{formatTimestamp(msg.createdAt)}</Text>
                  </View>
                  <Text style={styles.messageText}>{msg.body}</Text>
                </View>
              ))}
            </ScrollView>

            <TextInput
              value={careMessageInput}
              onChangeText={setCareMessageInput}
              placeholder="Write a message to your doctor..."
              placeholderTextColor="#7b8f88"
              style={styles.chatInput}
              multiline
            />

            <Pressable style={styles.primaryButton} onPress={() => void sendMessageToDoctor()}>
              <Text style={styles.primaryButtonText}>Message Doctor</Text>
            </Pressable>
          </SectionCard>

          <SectionCard title="Account & Safety" subtitle="Clear patient-facing safeguards.">
            <View style={styles.previewGrid}>
              <SummaryPill label="Role" value="Patient" />
              <SummaryPill label="Assigned Doctor" value={activePlan.doctorName} />
            </View>
            <Text style={styles.previewText}>
              Tether helps explain your doctor's plan, but it does not replace urgent care, emergency services, or a direct clinical assessment.
            </Text>
          </SectionCard>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 22,
    borderRadius: 28,
    backgroundColor: "#10211d",
    borderWidth: 1,
    borderColor: "#1f3d37",
    gap: 14,
  },
  kicker: {
    color: "#8fd0bf",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#f3f4ef",
    fontSize: 33,
    lineHeight: 38,
    fontWeight: "800",
  },
  heroText: { color: "#adc1bb", fontSize: 15, lineHeight: 24 },
  heroSubtext: { color: "#85a09a", fontSize: 13, lineHeight: 20 },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#e0d7c5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: { color: "#10211d", fontWeight: "800" },
  previewText: { color: "#243631", fontSize: 16, lineHeight: 25 },
  previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  escalationBanner: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f0e3bf",
    gap: 12,
  },
  escalationBannerText: {
    color: "#5a4718",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  listCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#fbf8ef",
    borderWidth: 1,
    borderColor: "#d8ceb9",
  },
  listTitle: { color: "#10211d", fontSize: 17, fontWeight: "800", marginBottom: 10 },
  listItem: { color: "#33453f", fontSize: 15, lineHeight: 24 },
  voiceStatusRow: { gap: 10 },
  statusDot: { width: 12, height: 12, borderRadius: 999 },
  statusGood: { backgroundColor: "#2b956e" },
  statusMuted: { backgroundColor: "#b28c54" },
  voiceStatusText: { color: "#495c56", fontSize: 14, fontWeight: "600" },
  audioToggle: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e2d9c8",
  },
  audioToggleActive: { backgroundColor: "#10211d" },
  audioToggleText: { color: "#10211d", fontWeight: "700" },
  audioToggleTextActive: { color: "#f4efe4" },
  errorText: { color: "#9f4134", fontSize: 14, lineHeight: 20 },
  transcriptCard: { padding: 14, borderRadius: 18, backgroundColor: "#e0f0ea" },
  transcriptLabel: {
    color: "#35695b",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  transcriptText: { marginTop: 6, color: "#10211d", fontSize: 15, lineHeight: 22 },
  chatLog: {
    maxHeight: 360,
    borderRadius: 22,
    backgroundColor: "#fbf8ef",
    borderWidth: 1,
    borderColor: "#d8ceb9",
  },
  chatLogContent: { padding: 14, gap: 12 },
  thinkingBubble: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#e7f4ef",
    borderWidth: 1,
    borderColor: "#c7dfd7",
  },
  thinkingText: { color: "#35695b", fontWeight: "700", fontStyle: "italic" },
  promptWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  promptChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e2d9c8",
  },
  promptChipText: { color: "#10211d", fontWeight: "700" },
  chatInput: {
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: "#fbf8ef",
    borderWidth: 1,
    borderColor: "#d8ceb9",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#10211d",
    fontSize: 15,
    textAlignVertical: "top",
  },
  buttonRow: { flexDirection: "row", gap: 12 },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#10211d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: "#f8f7f1", fontWeight: "800" },
  voiceButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#d7ebe4",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  voiceButtonActive: { backgroundColor: "#1b7662" },
  voiceButtonText: { color: "#10211d", fontWeight: "800" },
  voiceButtonTextActive: { color: "#f4efe4" },
  messageBubble: { padding: 14, borderRadius: 18 },
  assistantBubble: { backgroundColor: "#e7f4ef", borderWidth: 1, borderColor: "#c7dfd7" },
  patientBubble: { backgroundColor: "#f0e5d1", borderWidth: 1, borderColor: "#e1d0b2" },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  messageRole: { color: "#10211d", fontWeight: "800" },
  messageText: { marginTop: 8, color: "#243631", fontSize: 15, lineHeight: 23 },
  threadTime: { color: "#6f7f79", fontSize: 12, fontWeight: "600" },
});
