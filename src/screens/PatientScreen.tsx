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
import { LanguageDropdown } from "../components/LanguageDropdown";
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
  getJournal,
  addJournalEntry as apiAddJournalEntry,
  getAdherence,
  recordAdherence,
  type CareMessage,
  type BiomarkerRecord,
  type JournalEntry,
  type AdherenceRecord,
} from "../lib/appData";
import { quickPrompts, type DoctorPlan, type QuickPromptIntent } from "../lib/showcase";
import { generateAIReply, generateAIQuickReply, type AIContext } from "../lib/ai";
import { fleschKincaidGradeLevel, readabilityLabel } from "../lib/readability";
import {
  startBiomarkerRecording,
  stopAndAnalyze,
  cancelRecording,
  getRecordingElapsedSeconds,
  getMinRecordingSeconds,
  type BiomarkerReport,
} from "../lib/biomarker";
import { useLanguage, SUPPORTED_LANGUAGES, type Language } from "../lib/LanguageContext";
import { tpl } from "../lib/i18n";
import { SectionNav, type NavItem } from "../components/SectionNav";
import type { RootStackParamList } from "../lib/navigationTypes";
import { useScreenScroll } from "../lib/ScrollContext";

type Props = NativeStackScreenProps<RootStackParamList, "PatientCompanion">;

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function createGreeting(plan: DoctorPlan, greetingTemplate: string): ChatMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    urgency: "routine",
    text: tpl(greetingTemplate, { name: plan.patientName, doctor: plan.doctorName }),
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

function ThinkingBubble({ label }: { label: string }) {
  return (
    <View style={thinkingStyles.bubble}>
      <Text style={thinkingStyles.label}>{label}</Text>
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
  const { language, setLanguage: setContextLanguage, i } = useLanguage();

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
  const finalVoiceTranscriptRef = useRef("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalInput, setJournalInput] = useState("");
  const [adherenceRecords, setAdherenceRecords] = useState<AdherenceRecord[]>([]);
  const { registerSection, scrollToSection } = useScreenScroll();

  const navItems: NavItem[] = useMemo(() => [
    { key: "plan", label: i.navPlan },
    { key: "ai", label: i.navAI },
    { key: "voice", label: i.navVoice },
    { key: "journal", label: i.navJournal },
    { key: "meds", label: i.navMeds },
    { key: "doctor", label: i.navDoctor },
    { key: "account", label: i.navAccount },
  ], [i]);

  useEffect(() => {
    void (async () => {
      try {
        // Load independently so one failure doesn't block others
        const [plansResult, msgsResult, bioResult, journalResult, adherenceResult] = await Promise.allSettled([
          getPublishedPlans(user.email),
          getCareMessages(user.email),
          getBiomarkerHistory(user.email),
          getJournal(user.email),
          getAdherence(user.email),
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
        if (journalResult.status === "fulfilled") {
          setJournalEntries(journalResult.value);
        }
        if (adherenceResult.status === "fulfilled") {
          setAdherenceRecords(adherenceResult.value);
        }

        if (plansResult.status === "fulfilled") {
          const plan =
            plansResult.value.find(
              (p) => normalizeEmail(p.patientEmail) === normalizeEmail(user.email),
            ) ?? null;
          setActivePlan(plan);
          if (plan) {
            setMessages([createGreeting(plan, i.greetingText)]);
          }
        } else {
          Alert.alert(i.connectionError, i.connectionErrorMsg);
        }

        try {
          setVoiceSupported(ExpoSpeechRecognitionModule.isRecognitionAvailable());
        } catch {
          setVoiceSupported(false);
        }
      } catch (error) {
        console.error("Failed to load patient data:", error);
        Alert.alert(i.error, i.genericErrorMsg);
      }
    })();

    return () => {
      Speech.stop();
      void cancelRecording();
      setIsBiomarkerRecording(false);
      setIsAnalyzing(false);
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

  function getSpeechLang(): string {
    switch (language) {
      case "Spanish": return "es-ES";
      case "Hindi": return "hi-IN";
      case "Mandarin": return "zh-CN";
      case "French": return "fr-FR";
      case "Arabic": return "ar-SA";
      default: return "en-US";
    }
  }

  function speakReply(text: string) {
    try {
      Speech.stop();
      Speech.speak(text, { language: getSpeechLang() });
    } catch (speechError) {
      console.error("Speech synthesis failed:", speechError);
    }
  }

  async function submitPatientMessage(rawMessage?: string) {
    if (!activePlan || isThinking) return;
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

    const aiCtx: AIContext = { plan: activePlan, language, latestBiomarker: biomarkerReport, journalEntries, adherenceRecords };

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

      if (audioRepliesEnabled) speakReply(reply.message);
    } catch (error) {
      console.error("AI reply error:", error);
      setMessages((cur) => [
        ...cur,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: i.aiErrorMsg,
          urgency: "routine",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  async function sendQuickPrompt(label: string, intent: QuickPromptIntent) {
    if (!activePlan || isThinking) return;

    const patientMsg: ChatMessage = {
      id: `patient-${Date.now()}`,
      role: "patient",
      text: label,
    };

    setMessages((cur) => [...cur, patientMsg]);
    setIsThinking(true);

    const aiCtx: AIContext = { plan: activePlan, language, latestBiomarker: biomarkerReport, journalEntries, adherenceRecords };

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

      if (audioRepliesEnabled) speakReply(reply.message);
    } catch (error) {
      console.error("Quick prompt error:", error);
      setMessages((cur) => [
        ...cur,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: i.aiErrorMsg,
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
      Alert.alert(i.voiceBiomarkersTitle, i.voiceUnavailable);
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
        lang: getSpeechLang(),
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
          i.keepRecording,
          tpl(i.keepRecordingMsg, { min: getMinRecordingSeconds(), current: Math.round(elapsed) }),
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
            i.healthAlertTitle,
            report.summary + "\n\n" + i.healthAlertSuffix,
          );
        } else if (report.status === "monitor") {
          Alert.alert(
            i.monitoring,
            report.summary,
          );
        }
      } catch (error: any) {
        const message = error?.message || "Analysis failed. Please try again.";
        Alert.alert(i.biomarkerError, message);
        console.error("Biomarker error:", error);
      } finally {
        setIsBiomarkerRecording(false);
        setIsAnalyzing(false);
      }
    } else {
      try {
        setBiomarkerReport(null);
        await startBiomarkerRecording();
        setIsBiomarkerRecording(true);
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
      Alert.alert(i.sent, tpl(i.messageSentTo, { name: activePlan.doctorName }));
    } catch (error) {
      Alert.alert(i.error, i.sendFailed);
      console.error("Send message error:", error);
    }
  }

  async function handleSaveJournal() {
    const text = journalInput.trim();
    if (!text) return;
    if (text.length > 2000) {
      Alert.alert(i.error, i.journalTooLong);
      return;
    }
    try {
      const entry = await apiAddJournalEntry(user.email, text);
      setJournalEntries((prev) => [...prev, entry]);
      setJournalInput("");
      Alert.alert(i.sent, i.journalSaved);
    } catch (error) {
      Alert.alert(i.error, i.sendFailed);
      console.error("Journal save error:", error);
    }
  }

  async function handleAdherence(taken: boolean) {
    const today = new Date().toISOString().split("T")[0];
    const alreadyRecorded = adherenceRecords.some((r) => r.date === today);
    if (alreadyRecorded) {
      Alert.alert(i.medicationAdherence, i.todayRecorded);
      return;
    }
    try {
      const record = await recordAdherence(user.email, today, taken);
      setAdherenceRecords((prev) => [...prev, record]);
      Alert.alert(i.sent, i.adherenceRecorded);
    } catch (error) {
      Alert.alert(i.error, i.sendFailed);
      console.error("Adherence error:", error);
    }
  }

  async function handleLanguageChange(lang: Language) {
    setContextLanguage(lang);
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
      <SectionNav items={activePlan ? navItems : []} onPress={scrollToSection} />

      <View style={styles.heroCard}>
        <Text style={styles.kicker}>{i.patientCompanion}</Text>
        <Text style={styles.heroTitle}>{user.name}</Text>
        <Text style={styles.heroText}>
          {i.patientHeroText}
        </Text>
        <Text style={styles.heroSubtext}>
          {i.patientHeroSubtext}
        </Text>
        <Pressable style={styles.secondaryButton} onPress={() => void handleLogout()}>
          <Text style={styles.secondaryButtonText}>{i.logOut}</Text>
        </Pressable>
      </View>

      <SectionCard title={i.languageTitle} subtitle={i.languageSubtitle}>
        <LanguageDropdown current={language} onSelect={(lang) => void handleLanguageChange(lang)} />
      </SectionCard>

      {!activePlan ? (
        <SectionCard
          title={i.noPlanTitle}
          subtitle={i.noPlanSubtitle}
        >
          <Text style={styles.previewText}>
            {i.noPlanText}
          </Text>
        </SectionCard>
      ) : (
        <>
          <View onLayout={(e) => registerSection("plan", e.nativeEvent.layout.y)}>
          <SectionCard
            title={`${activePlan.patientName} — ${i.recoveryPlan}`}
            subtitle={`${i.publishedBy} ${activePlan.doctorName} · ${formatTimestamp(activePlan.lastUpdatedAt)}`}
          >
            <View style={styles.escalationBanner}>
              <Text style={styles.escalationBannerText}>
                {i.emergencyWarning}
              </Text>
            </View>

            <View style={styles.previewGrid}>
              <SummaryPill label={i.heartRate} value={activePlan.heartRate} />
              <SummaryPill label={i.bloodPressure} value={activePlan.bloodPressure} />
              <SummaryPill label={i.temperature} value={activePlan.temperature} />
              <SummaryPill label={i.oxygen} value={activePlan.oxygenSaturation} />
            </View>

            <View style={styles.listCard}>
              <Text style={styles.listTitle}>{i.whatToDoToday}</Text>
              {activePlan.dailyInstructions.map((item) => (
                <Text key={item} style={styles.listItem}>• {item}</Text>
              ))}
            </View>

            <View style={styles.listCard}>
              <Text style={styles.listTitle}>{i.callForHelp}</Text>
              {activePlan.redFlags.map((item) => (
                <Text key={item} style={styles.listItem}>• {item}</Text>
              ))}
            </View>
          </SectionCard>
          </View>

          <View onLayout={(e) => registerSection("ai", e.nativeEvent.layout.y)}>
          <SectionCard title={i.askTetherAI} subtitle={i.askAISubtitle}>
            <View style={styles.voiceStatusRow}>
              <View style={[styles.statusDot, voiceSupported ? styles.statusGood : styles.statusMuted]} />
              <Text style={styles.voiceStatusText}>
                {voiceSupported ? i.voiceAvailable : i.voiceUnavailable}
              </Text>
              <Pressable
                onPress={() => setAudioRepliesEnabled((v) => !v)}
                style={[styles.audioToggle, audioRepliesEnabled && styles.audioToggleActive]}
              >
                <Text style={[styles.audioToggleText, audioRepliesEnabled && styles.audioToggleTextActive]}>
                  {audioRepliesEnabled ? i.voiceReplyOn : i.voiceReplyOff}
                </Text>
              </Pressable>
            </View>

            {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}

            {liveTranscript ? (
              <View style={styles.transcriptCard}>
                <Text style={styles.transcriptLabel}>{i.listening}</Text>
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
              {isThinking ? <ThinkingBubble label={i.tetherAI} /> : null}
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
              placeholder={i.typeQuestion}
              placeholderTextColor="#94a3b8"
              style={styles.chatInput}
              multiline
            />

            <View style={styles.buttonRow}>
              <AnimatedButton
                label={i.sendToAI}
                variant="primary"
                onPress={() => void submitPatientMessage()}
                accessibilityLabel={i.sendToAI}
              />
              <AnimatedButton
                label={isListening ? i.stopListening : i.startVoiceChat}
                variant={isListening ? "voiceActive" : "voice"}
                onPress={() => void handleVoiceToggle()}
                accessibilityLabel={isListening ? i.stopListening : i.startVoiceChat}
              />
            </View>
          </SectionCard>
          </View>

          <View onLayout={(e) => registerSection("voice", e.nativeEvent.layout.y)}>
          <SectionCard
            title={i.voiceBiomarkers}
            subtitle={i.biomarkerSubtitle}
          >
            <View style={styles.buttonRow}>
              <AnimatedButton
                label={
                  isAnalyzing
                    ? i.analyzing
                    : isBiomarkerRecording
                      ? `${i.stopAnalyze} (${recordingSeconds}s)`
                      : i.startVoiceCheck
                }
                variant={isBiomarkerRecording ? "voiceActive" : "voice"}
                onPress={() => void handleBiomarkerToggle()}
                disabled={isAnalyzing}
                accessibilityLabel={
                  isAnalyzing
                    ? i.analyzing
                    : isBiomarkerRecording
                      ? `${i.stopAnalyze} (${recordingSeconds}s)`
                      : i.startVoiceCheck
                }
              />
            </View>
            {isBiomarkerRecording ? (
              <View style={styles.recordingCard}>
                <View style={styles.recordingHeader}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingLabel}>{i.recording} — {recordingSeconds}s</Text>
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
                    ? `${i.keepGoing} — ${getMinRecordingSeconds() - recordingSeconds}s`
                    : i.goodLength}
                </Text>
              </View>
            ) : null}
            {biomarkerReport ? <BiomarkerCard report={biomarkerReport} history={biomarkerHistory} /> : null}
          </SectionCard>
          </View>

          <View onLayout={(e) => registerSection("journal", e.nativeEvent.layout.y)}>
          <SectionCard title={i.journalTitle} subtitle={i.journalSubtitle}>
            {activePlan.dischargeDate ? (
              <View style={styles.dischargeBadge}>
                <Text style={styles.dischargeBadgeText}>
                  {tpl(i.daysSinceDischarge, { days: Math.floor((Date.now() - new Date(activePlan.dischargeDate).getTime()) / (1000 * 60 * 60 * 24)) })}
                </Text>
              </View>
            ) : null}
            <TextInput
              value={journalInput}
              onChangeText={setJournalInput}
              placeholder={i.journalPlaceholder}
              placeholderTextColor="#94a3b8"
              style={styles.chatInput}
              multiline
            />
            <AnimatedButton
              label={i.addJournalEntry}
              variant="primary"
              onPress={() => void handleSaveJournal()}
              accessibilityLabel={i.addJournalEntry}
            />
            {journalEntries.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📓</Text>
                <Text style={styles.emptyStateText}>{i.noJournalEntries}</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.chatLog}
                contentContainerStyle={styles.chatLogContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {[...journalEntries].reverse().slice(0, 10).map((entry) => (
                  <View key={entry.id} style={styles.journalEntry}>
                    <Text style={styles.journalDate}>{formatTimestamp(entry.createdAt)}</Text>
                    <Text style={styles.journalText}>{entry.text}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </SectionCard>
          </View>

          <View onLayout={(e) => registerSection("meds", e.nativeEvent.layout.y)}>
          <SectionCard title={i.medicationAdherence} subtitle={i.adherenceSubtitle}>
            <Text style={styles.adherenceQuestion}>{i.didYouTakeMeds}</Text>
            <View style={styles.buttonRow}>
              <AnimatedButton
                label={i.yesTook}
                variant="primary"
                onPress={() => void handleAdherence(true)}
                accessibilityLabel={i.yesTook}
              />
              <AnimatedButton
                label={i.noMissed}
                variant="secondary"
                onPress={() => void handleAdherence(false)}
                accessibilityLabel={i.noMissed}
              />
            </View>
            {adherenceRecords.length > 0 ? (
              <View style={styles.adherenceStats}>
                <Text style={styles.adherenceStatsTitle}>{i.adherenceStreak}</Text>
                <View style={styles.adherenceDots}>
                  {adherenceRecords.slice(-7).map((r) => (
                    <View key={r.id} style={[styles.adherenceDot, r.taken ? styles.adherenceTaken : styles.adherenceMissed]} />
                  ))}
                </View>
                <View style={styles.previewGrid}>
                  <SummaryPill label={tpl(i.takenCount, { count: adherenceRecords.slice(-7).filter(r => r.taken).length })} value="✓" />
                  <SummaryPill label={tpl(i.missedCount, { count: adherenceRecords.slice(-7).filter(r => !r.taken).length })} value="✗" />
                </View>
              </View>
            ) : null}
          </SectionCard>
          </View>

          <View onLayout={(e) => registerSection("doctor", e.nativeEvent.layout.y)}>
          <SectionCard
            title={tpl(i.messageDoctorTitle, { name: activePlan.doctorName })}
            subtitle={i.messageDoctorSubtitle}
          >
            {latestAssistantMessage?.handoffSuggested ? (
              <View style={styles.escalationBanner}>
                <Text style={styles.escalationBannerText}>
                  {i.aiRecommendsMsgDoctor}
                </Text>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    void sendMessageToDoctor(
                      `Hi ${activePlan.doctorName}, I need help with: ${patientInput || "my current symptoms and recovery plan."}`,
                    )
                  }
                >
                  <Text style={styles.secondaryButtonText}>{i.sendQuickHelpRequest}</Text>
                </Pressable>
              </View>
            ) : null}

            {patientConversation.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>💬</Text>
                <Text style={styles.emptyStateText}>
                  {i.noMessagesYet} {tpl(i.noMessagesHint, { name: activePlan.doctorName })}
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
              placeholder={i.writeMessagePlaceholder}
              placeholderTextColor="#94a3b8"
              style={styles.chatInput}
              multiline
            />

            <AnimatedButton
              label={i.messageDoctor}
              variant="primary"
              onPress={() => void sendMessageToDoctor()}
              accessibilityLabel={i.messageDoctor}
            />
          </SectionCard>
          </View>

          <View onLayout={(e) => registerSection("account", e.nativeEvent.layout.y)}>
          <SectionCard title={i.accountSafety} subtitle={i.accountSafetySubtitle}>
            <View style={styles.previewGrid}>
              <SummaryPill label={i.role} value={i.patient} />
              <SummaryPill label={i.assignedDoctor} value={activePlan.doctorName} />
            </View>
            <Text style={styles.previewText}>
              {i.safetyDisclaimer}
            </Text>
          </SectionCard>
          </View>

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
  journalEntry: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  journalDate: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  journalText: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
  },
  dischargeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
  },
  dischargeBadgeText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700",
  },
  adherenceQuestion: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
  },
  adherenceStats: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  adherenceStatsTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },
  adherenceDots: {
    flexDirection: "row",
    gap: 8,
  },
  adherenceDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  adherenceTaken: {
    backgroundColor: "#22c55e",
  },
  adherenceMissed: {
    backgroundColor: "#ef4444",
  },
});
