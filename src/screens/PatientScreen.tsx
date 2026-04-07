import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
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

import { AnimatedButton } from "../components/AnimatedButton";
import { BiomarkerCard } from "../components/BiomarkerCard";
import { MessageBubble, type ChatMessage } from "../components/MessageBubble";
import { SectionCard } from "../components/SectionCard";
import { SummaryPill } from "../components/SummaryPill";
import {
  addCareMessage,
  getCareMessages,
  getPublishedPlans,
  getBiomarkerHistory,
  saveBiomarkerReport,
  setUserLanguage,
  normalizeEmail,
  saveSession,
  cacheUser,
  type CareMessage,
  type BiomarkerRecord,
} from "../lib/appData";
import { quickPrompts, type DoctorPlan, type QuickPromptIntent } from "../lib/showcase";
import { generateAIReply, generateAIQuickReply, type AIContext } from "../lib/ai";
import { fleschKincaidGradeLevel, readabilityLabel } from "../lib/readability";
import {
  startBiomarkerRecording,
  stopAndAnalyze,
  cancelRecording,
  isRecording as checkIsRecording,
  getRecordingElapsedSeconds,
  getMinRecordingSeconds,
  type BiomarkerReport,
} from "../lib/biomarker";
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

function ThinkingDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [delay, opacity]);
  return <Animated.View style={[thinkingStyles.dot, { opacity }]} />;
}

function ThinkingBubble() {
  return (
    <View style={thinkingStyles.bubble}>
      <Text style={thinkingStyles.label}>Tether AI</Text>
      <View style={thinkingStyles.dots}>
        <ThinkingDot delay={0} />
        <ThinkingDot delay={150} />
        <ThinkingDot delay={300} />
      </View>
    </View>
  );
}

const thinkingStyles = StyleSheet.create({
  bubble: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    gap: 8,
  },
  label: {
    color: "#1d4ed8",
    fontWeight: "800",
    fontSize: 13,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
  },
});

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
  const [biomarkerReport, setBiomarkerReport] = useState<BiomarkerReport | null>(null);
  const [biomarkerHistory, setBiomarkerHistory] = useState<BiomarkerRecord[]>([]);
  const [isBiomarkerRecording, setIsBiomarkerRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [language, setLanguage] = useState(user.language || "English");
  const finalVoiceTranscriptRef = useRef("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        // Load independently so one failure doesn't block others
        const [plansResult, msgsResult, bioResult] = await Promise.allSettled([
          getPublishedPlans(user.email),
          getCareMessages(user.email),
          getBiomarkerHistory(user.email),
        ]);

        if (msgsResult.status === "fulfilled") {
          setCareMessages(msgsResult.value);
        }
        if (bioResult.status === "fulfilled") {
          setBiomarkerHistory(bioResult.value);
          if (bioResult.value.length > 0) {
            setBiomarkerReport(bioResult.value[bioResult.value.length - 1].report);
          }
        }

        if (plansResult.status === "fulfilled") {
          const plan =
            plansResult.value.find(
              (p) => normalizeEmail(p.patientEmail) === normalizeEmail(user.email),
            ) ?? null;
          setActivePlan(plan);
          if (plan) {
            setMessages([createGreeting(plan)]);
          }
        } else {
          Alert.alert("Connection Error", "Could not load your care plan. Pull down to refresh or restart the app.");
        }

        try {
          setVoiceSupported(ExpoSpeechRecognitionModule.isRecognitionAvailable());
        } catch {
          setVoiceSupported(false);
        }
      } catch (error) {
        console.error("Failed to load patient data:", error);
        Alert.alert("Error", "Could not connect to the server. Check your internet connection.");
      }
    })();

    return () => {
      Speech.stop();
      void cancelRecording();
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Safe no-op
      }
    };
  }, [user]);

  // Recording timer
  useEffect(() => {
    if (!isBiomarkerRecording) {
      setRecordingSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setRecordingSeconds(Math.round(getRecordingElapsedSeconds()));
    }, 500);
    return () => clearInterval(interval);
  }, [isBiomarkerRecording]);

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

    const aiCtx: AIContext = { plan: activePlan, language, latestBiomarker: biomarkerReport };

    try {
      const reply = await generateAIReply(aiCtx, message);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: reply.message,
        urgency: reply.urgency,
        handoffSuggested: reply.handoffSuggested,
      };
      setMessages((cur) => [...cur, assistantMsg]);

      const speechLang = language === "Spanish" ? "es" : language === "Hindi" ? "hi" : language === "Mandarin" ? "zh-CN" : language === "French" ? "fr" : language === "Arabic" ? "ar" : "en-US";
      if (audioRepliesEnabled) {
        Speech.stop();
        Speech.speak(reply.message, { language: speechLang, pitch: 1, rate: 0.96 });
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

    const aiCtx: AIContext = { plan: activePlan, language, latestBiomarker: biomarkerReport };

    try {
      const reply = await generateAIQuickReply(aiCtx, label, intent);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: reply.message,
        urgency: reply.urgency,
        handoffSuggested: reply.handoffSuggested,
      };
      setMessages((cur) => [...cur, assistantMsg]);

      const speechLang = language === "Spanish" ? "es" : language === "Hindi" ? "hi" : language === "Mandarin" ? "zh-CN" : language === "French" ? "fr" : language === "Arabic" ? "ar" : "en-US";
      if (audioRepliesEnabled) {
        Speech.stop();
        Speech.speak(reply.message, { language: speechLang, pitch: 1, rate: 0.96 });
      }
    } catch (error) {
      console.error("Quick prompt error:", error);
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

  async function handleBiomarkerToggle() {
    if (isBiomarkerRecording) {
      const elapsed = getRecordingElapsedSeconds();
      if (elapsed < getMinRecordingSeconds()) {
        Alert.alert(
          "Keep Recording",
          `Please record for at least ${getMinRecordingSeconds()} seconds. You've recorded ${Math.round(elapsed)} seconds so far.`,
        );
        return;
      }
      setIsAnalyzing(true);
      try {
        const report = await stopAndAnalyze();
        setBiomarkerReport(report);
        // Save to server for trending
        const record = await saveBiomarkerReport(user.email, report);
        setBiomarkerHistory(prev => [...prev, record]);
        if (report.status === "alert" && activePlan) {
          // Auto-escalate: send biomarker alert to doctor immediately
          try {
            await addCareMessage({
              doctorEmail: activePlan.doctorEmail,
              patientEmail: activePlan.patientEmail,
              senderRole: "patient",
              senderName: "Tether Biomarker Alert",
              body: `⚠️ Automatic biomarker alert for ${activePlan.patientName}:\n\n${report.summary}\n\nConfidence: ${Math.round((report.confidence ?? 0) * 100)}%\n\nThis message was sent automatically because the voice analysis returned an alert status.`,
            });
            setCareMessages(await getCareMessages(user.email));
          } catch (escalationError) {
            console.error("Auto-escalation failed:", escalationError);
          }
          Alert.alert(
            "Health Alert — Doctor Notified",
            report.summary + "\n\nYour doctor has been automatically notified of this alert.",
          );
        } else if (report.status === "monitor") {
          Alert.alert(
            "Monitoring",
            report.summary,
          );
        }
      } catch (error: any) {
        const message = error?.message || "Analysis failed. Please try again.";
        Alert.alert("Biomarker Error", message);
        console.error("Biomarker error:", error);
      } finally {
        setIsBiomarkerRecording(false);
        setIsAnalyzing(false);
      }
    } else {
      try {
        await startBiomarkerRecording();
        setIsBiomarkerRecording(true);
        setBiomarkerReport(null);
      } catch (error: any) {
        const message = error?.message === "Microphone permission not granted"
          ? "Microphone access was denied. Please enable it in your device settings."
          : "Could not start audio recording. Make sure no other app is using the microphone.";
        Alert.alert("Recording Error", message);
        console.error("Biomarker start error:", error);
      }
    }
  }

  async function sendMessageToDoctor(prefill?: string) {
    if (!activePlan) return;
    const body = (prefill ?? careMessageInput).trim();
    if (!body) return;

    try {
      await addCareMessage({
        doctorEmail: activePlan.doctorEmail,
        patientEmail: activePlan.patientEmail,
        senderRole: "patient",
        senderName: user.name,
        body,
      });
      setCareMessages(await getCareMessages(user.email));
      setCareMessageInput("");
      Alert.alert("Sent", `Your message was sent to ${activePlan.doctorName}.`);
    } catch (error) {
      Alert.alert("Error", "Failed to send message. Please try again.");
      console.error("Send message error:", error);
    }
  }

  async function handleLanguageChange(lang: string) {
    setLanguage(lang);
    try {
      await setUserLanguage(user.email, lang);
      await cacheUser({ ...user, language: lang });
    } catch (error) {
      console.error("Failed to save language:", error);
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

      <SectionCard title="Language" subtitle="AI responses and voice output will use your preferred language.">
        <View style={styles.promptWrap}>
          {["English", "Spanish", "Hindi", "Mandarin", "French", "Arabic"].map((lang) => (
            <Pressable
              key={lang}
              style={[styles.promptChip, language === lang && styles.promptChipActive]}
              onPress={() => void handleLanguageChange(lang)}
            >
              <Text style={[styles.promptChipText, language === lang && styles.promptChipTextActive]}>{lang}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

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
              {isThinking ? <ThinkingBubble /> : null}
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
              placeholderTextColor="#94a3b8"
              style={styles.chatInput}
              multiline
            />

            <View style={styles.buttonRow}>
              <AnimatedButton
                label="Send to AI"
                variant="primary"
                onPress={() => void submitPatientMessage()}
                accessibilityLabel="Send message to Tether AI"
              />
              <AnimatedButton
                label={isListening ? "Stop Listening" : "Start Voice Chat"}
                variant={isListening ? "voiceActive" : "voice"}
                onPress={() => void handleVoiceToggle()}
                accessibilityLabel={isListening ? "Stop voice recognition" : "Start voice recognition"}
              />
            </View>
          </SectionCard>

          <SectionCard
            title="Voice Biomarkers"
            subtitle="Record a voice sample to analyze breathing, cough patterns, and vocal health."
          >
            <View style={styles.buttonRow}>
              <AnimatedButton
                label={
                  isAnalyzing
                    ? "Analyzing..."
                    : isBiomarkerRecording
                      ? `Stop & Analyze (${recordingSeconds}s)`
                      : "Start Voice Check"
                }
                variant={isBiomarkerRecording ? "voiceActive" : "voice"}
                onPress={() => void handleBiomarkerToggle()}
                disabled={isAnalyzing}
                accessibilityLabel={
                  isAnalyzing
                    ? "Analyzing voice biomarkers"
                    : isBiomarkerRecording
                      ? `Stop recording. ${recordingSeconds} seconds recorded`
                      : "Start voice biomarker recording"
                }
              />
            </View>
            {isBiomarkerRecording ? (
              <View style={styles.recordingCard}>
                <View style={styles.recordingHeader}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingLabel}>Recording — {recordingSeconds}s</Text>
                </View>
                <View style={styles.recordingProgress}>
                  <View
                    style={[
                      styles.recordingProgressFill,
                      {
                        width: `${Math.min(100, (recordingSeconds / 15) * 100)}%`,
                        backgroundColor: recordingSeconds < getMinRecordingSeconds() ? "#f59e0b" : "#22c55e",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.recordingHint}>
                  {recordingSeconds < getMinRecordingSeconds()
                    ? `Keep going — ${getMinRecordingSeconds() - recordingSeconds}s more needed`
                    : "Good recording length. Tap Stop & Analyze when ready."}
                </Text>
              </View>
            ) : null}
            {biomarkerReport ? <BiomarkerCard report={biomarkerReport} history={biomarkerHistory} /> : null}
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

            {patientConversation.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>💬</Text>
                <Text style={styles.emptyStateText}>
                  No messages yet. Send a message to {activePlan.doctorName} when you need human guidance.
                </Text>
              </View>
            ) : (
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
            )}

            <TextInput
              value={careMessageInput}
              onChangeText={setCareMessageInput}
              placeholder="Write a message to your doctor..."
              placeholderTextColor="#94a3b8"
              style={styles.chatInput}
              multiline
            />

            <AnimatedButton
              label="Message Doctor"
              variant="primary"
              onPress={() => void sendMessageToDoctor()}
              accessibilityLabel={`Send message to ${activePlan.doctorName}`}
            />
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
    backgroundColor: "#1d4ed8",
    gap: 14,
  },
  kicker: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 33,
    lineHeight: 38,
    fontWeight: "800",
  },
  heroText: { color: "#dbeafe", fontSize: 15, lineHeight: 24 },
  heroSubtext: { color: "#93c5fd", fontSize: 13, lineHeight: 20 },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: { color: "#0f172a", fontWeight: "800" },
  previewText: { color: "#334155", fontSize: 16, lineHeight: 25 },
  previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  escalationBanner: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#fef3c7",
    gap: 12,
  },
  escalationBannerText: {
    color: "#92400e",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  listCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  listTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800", marginBottom: 10 },
  listItem: { color: "#334155", fontSize: 15, lineHeight: 24 },
  voiceStatusRow: { gap: 10 },
  statusDot: { width: 12, height: 12, borderRadius: 999 },
  statusGood: { backgroundColor: "#22c55e" },
  statusMuted: { backgroundColor: "#f59e0b" },
  voiceStatusText: { color: "#64748b", fontSize: 14, fontWeight: "600" },
  audioToggle: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  audioToggleActive: { backgroundColor: "#1d4ed8" },
  audioToggleText: { color: "#334155", fontWeight: "700" },
  audioToggleTextActive: { color: "#ffffff" },
  errorText: { color: "#dc2626", fontSize: 14, lineHeight: 20 },
  transcriptCard: { padding: 14, borderRadius: 18, backgroundColor: "#eff6ff" },
  transcriptLabel: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  transcriptText: { marginTop: 6, color: "#0f172a", fontSize: 15, lineHeight: 22 },
  chatLog: {
    maxHeight: 360,
    borderRadius: 22,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chatLogContent: { padding: 14, gap: 12 },
  thinkingBubble: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  thinkingText: { color: "#1d4ed8", fontWeight: "700", fontStyle: "italic" },
  promptWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  promptChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  promptChipActive: { backgroundColor: "#1d4ed8" },
  promptChipText: { color: "#334155", fontWeight: "700" },
  promptChipTextActive: { color: "#ffffff" },
  chatInput: {
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#0f172a",
    fontSize: 15,
    textAlignVertical: "top",
  },
  buttonRow: { flexDirection: "row", gap: 12 },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: "#ffffff", fontWeight: "800" },
  voiceButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  voiceButtonActive: { backgroundColor: "#2563eb" },
  buttonDisabled: { opacity: 0.6 },
  voiceButtonText: { color: "#1d4ed8", fontWeight: "800" },
  voiceButtonTextActive: { color: "#ffffff" },
  messageBubble: { padding: 14, borderRadius: 18 },
  assistantBubble: { backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe" },
  patientBubble: { backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  messageRole: { color: "#0f172a", fontWeight: "800" },
  messageText: { marginTop: 8, color: "#334155", fontSize: 15, lineHeight: 23 },
  threadTime: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  recordingCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 10,
  },
  recordingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  recordingLabel: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "800",
  },
  recordingProgress: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fecaca",
    overflow: "hidden",
  },
  recordingProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  recordingHint: {
    color: "#7f1d1d",
    fontSize: 13,
    lineHeight: 19,
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyStateIcon: {
    fontSize: 32,
  },
  emptyStateText: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
});
