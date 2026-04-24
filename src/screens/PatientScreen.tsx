import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { AnatomyView } from "../components/AnatomyView";
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
  const [medChecklist, setMedChecklist] = useState<Record<string, boolean>>({});
  const [todoChecklist, setTodoChecklist] = useState<Record<string, boolean>>({});
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

  // Load today's medication and to-do checklists from local storage
  useEffect(() => {
    void (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const medKey = `tether-med-checklist:${user.email}:${today}`;
        const todoKey = `tether-todo-checklist:${user.email}:${today}`;
        const [medStored, todoStored] = await Promise.all([
          AsyncStorage.getItem(medKey),
          AsyncStorage.getItem(todoKey),
        ]);
        if (medStored) setMedChecklist(JSON.parse(medStored));
        if (todoStored) setTodoChecklist(JSON.parse(todoStored));
      } catch (error) {
        console.error("Failed to load checklist:", error);
      }
    })();
  }, [user.email]);

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
      case "Portuguese": return "pt-BR";
      case "German": return "de-DE";
      case "Italian": return "it-IT";
      case "Russian": return "ru-RU";
      case "Japanese": return "ja-JP";
      case "Korean": return "ko-KR";
      case "Vietnamese": return "vi-VN";
      case "Bengali": return "bn-IN";
      case "Urdu": return "ur-PK";
      case "Tagalog": return "fil-PH";
      case "Swahili": return "sw-KE";
      case "Turkish": return "tr-TR";
      case "Polish": return "pl-PL";
      case "Dutch": return "nl-NL";
      case "Greek": return "el-GR";
      case "Hebrew": return "he-IL";
      case "Thai": return "th-TH";
      case "Indonesian": return "id-ID";
      case "Punjabi": return "pa-IN";
      case "Ukrainian": return "uk-UA";
      default: return "en-US";
    }
  }

  function speakReply(text: string) {
    try {
      Speech.stop();
      Speech.speak(text, { language: getSpeechLang(), voice: "com.apple.ttsbundle.Samantha-compact" });
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
      Alert.alert(i.sent, tpl(i.messageSentTo, { name: activePlan.careNavigatorName ?? i.careNavigatorLabel }));
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

  function medChecklistKey(): string {
    const today = new Date().toISOString().split("T")[0];
    return `tether-med-checklist:${user.email}:${today}`;
  }

  function todoChecklistKey(): string {
    const today = new Date().toISOString().split("T")[0];
    return `tether-todo-checklist:${user.email}:${today}`;
  }

  async function toggleTodoItem(item: string) {
    const next = { ...todoChecklist, [item]: !todoChecklist[item] };
    setTodoChecklist(next);
    try {
      await AsyncStorage.setItem(todoChecklistKey(), JSON.stringify(next));
    } catch (error) {
      console.error("Todo save error:", error);
    }
  }

  async function toggleMedChecklistItem(med: string) {
    const next = { ...medChecklist, [med]: !medChecklist[med] };
    setMedChecklist(next);
    try {
      await AsyncStorage.setItem(medChecklistKey(), JSON.stringify(next));
    } catch (error) {
      console.error("Checklist save error:", error);
    }

    // Compute "all taken today" and record adherence
    const meds = activePlan?.medications ?? [];
    if (meds.length === 0) return;
    const allTaken = meds.every((m) => next[m]);

    const today = new Date().toISOString().split("T")[0];
    try {
      const record = await recordAdherence(user.email, today, allTaken);
      setAdherenceRecords((prev) => {
        const filtered = prev.filter((r) => r.date !== today);
        return [...filtered, record];
      });
    } catch (error) {
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
        {activePlan ? (
          <View style={styles.careTeamCard}>
            <View style={styles.careTeamRow}>
              <Text style={styles.careTeamLabel}>{i.patientNameLabel}</Text>
              <Text style={styles.careTeamValue}>{activePlan.patientName}</Text>
            </View>
            <View style={styles.careTeamRow}>
              <Text style={styles.careTeamLabel}>{i.doctorNameLabel}</Text>
              <Text style={styles.careTeamValue}>{activePlan.doctorName}</Text>
            </View>
            <View style={styles.careTeamRow}>
              <Text style={styles.careTeamLabel}>{i.careNavigatorLabel}</Text>
              <Text style={styles.careTeamValue}>{activePlan.careNavigatorName ?? "—"}</Text>
            </View>
          </View>
        ) : null}
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

            <AnatomyView plan={activePlan} />

            <View style={styles.listCard}>
              <Text style={styles.listTitle}>{i.whatToDoToday}</Text>
              <View style={styles.todoList}>
                {activePlan.dailyInstructions.map((item) => {
                  const checked = !!todoChecklist[item];
                  return (
                    <Pressable
                      key={item}
                      style={[styles.medCheckItem, checked && styles.medCheckItemDone]}
                      onPress={() => void toggleTodoItem(item)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                    >
                      <View style={[styles.medCheckBox, checked && styles.medCheckBoxDone]}>
                        {checked ? <Text style={styles.medCheckMark}>✓</Text> : null}
                      </View>
                      <Text style={[styles.medCheckText, checked && styles.medCheckTextDone]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
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
            <View style={styles.voiceGuidance}>
              <Text style={styles.voiceGuidanceTitle}>{i.voiceGuidanceTitle}</Text>
              <Text style={styles.voiceGuidanceItem}>{i.voiceGuidanceMorning}</Text>
              <Text style={styles.voiceGuidanceItem}>{i.voiceGuidanceNight}</Text>
              <Text style={styles.voiceGuidanceFootnote}>{i.voiceGuidanceFootnote}</Text>
            </View>
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
            {activePlan.medications.length === 0 ? (
              <Text style={styles.adherenceQuestion}>{i.noMedsToday}</Text>
            ) : (
              <>
                <View style={styles.checklistProgress}>
                  <Text style={styles.checklistProgressText}>
                    {activePlan.medications.filter(m => medChecklist[m]).length} / {activePlan.medications.length} {i.takenToday}
                  </Text>
                  <View style={styles.checklistProgressBar}>
                    <View
                      style={[
                        styles.checklistProgressFill,
                        {
                          width: `${(activePlan.medications.filter(m => medChecklist[m]).length / activePlan.medications.length) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.medChecklist}>
                  {activePlan.medications.map((med) => {
                    const checked = !!medChecklist[med];
                    return (
                      <Pressable
                        key={med}
                        style={[styles.medCheckItem, checked && styles.medCheckItemDone]}
                        onPress={() => void toggleMedChecklistItem(med)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                      >
                        <View style={[styles.medCheckBox, checked && styles.medCheckBoxDone]}>
                          {checked ? <Text style={styles.medCheckMark}>✓</Text> : null}
                        </View>
                        <Text style={[styles.medCheckText, checked && styles.medCheckTextDone]}>
                          {med}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
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
            title={i.messageDoctorTitle}
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
                      `Hi ${activePlan.careNavigatorName ?? "Care Navigator"}, I need help with: ${patientInput || "my current symptoms and recovery plan."}`,
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
                  {i.noMessagesYet} {tpl(i.noMessagesHint, { name: activePlan.careNavigatorName ?? i.careNavigatorLabel })}
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
                      <Text style={styles.messageRole}>
                        {msg.senderRole === "doctor"
                          ? (activePlan.careNavigatorName ?? i.careNavigatorLabel)
                          : msg.senderName}
                      </Text>
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
    borderRadius: 20,
    backgroundColor: "#007AFF",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  kicker: {
    color: "#CFE4FF",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  heroText: { color: "#DBEAFE", fontSize: 15, lineHeight: 22 },
  heroSubtext: { color: "#A7C8FF", fontSize: 13, lineHeight: 19 },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 15, letterSpacing: -0.2 },
  previewText: { color: "#3C3C43", fontSize: 16, lineHeight: 22 },
  previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  escalationBanner: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFF4E0",
    gap: 8,
  },
  escalationBannerText: {
    color: "#925300",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  listCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
  },
  listTitle: { color: "#1C1C1E", fontSize: 15, fontWeight: "600", marginBottom: 8, letterSpacing: -0.2 },
  listItem: { color: "#3C3C43", fontSize: 15, lineHeight: 22 },
  voiceStatusRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  statusDot: { width: 10, height: 10, borderRadius: 999 },
  statusGood: { backgroundColor: "#34C759" },
  statusMuted: { backgroundColor: "#FF9500" },
  voiceStatusText: { color: "#8E8E93", fontSize: 14, fontWeight: "500" },
  audioToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F2F2F7",
  },
  audioToggleActive: { backgroundColor: "#007AFF" },
  audioToggleText: { color: "#3C3C43", fontWeight: "500", fontSize: 13 },
  audioToggleTextActive: { color: "#ffffff", fontWeight: "600" },
  errorText: { color: "#FF3B30", fontSize: 14, lineHeight: 20 },
  transcriptCard: { padding: 14, borderRadius: 12, backgroundColor: "#E5F0FF" },
  transcriptLabel: {
    color: "#007AFF",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  transcriptText: { marginTop: 4, color: "#1C1C1E", fontSize: 15, lineHeight: 22 },
  chatLog: {
    maxHeight: 360,
    borderRadius: 14,
    backgroundColor: "#F2F2F7",
  },
  chatLogContent: { padding: 12, gap: 10 },
  thinkingBubble: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#E5F0FF",
  },
  thinkingText: { color: "#007AFF", fontWeight: "500", fontStyle: "italic" },
  promptWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  promptChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F2F2F7",
  },
  promptChipActive: { backgroundColor: "#007AFF" },
  promptChipText: { color: "#3C3C43", fontWeight: "500", fontSize: 13 },
  promptChipTextActive: { color: "#ffffff", fontWeight: "600" },
  chatInput: {
    minHeight: 60,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1C1C1E",
    fontSize: 16,
    textAlignVertical: "top",
  },
  buttonRow: { flexDirection: "row", gap: 10 },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
  voiceButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#E5F0FF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  voiceButtonActive: { backgroundColor: "#0051D5" },
  buttonDisabled: { opacity: 0.5 },
  voiceButtonText: { color: "#007AFF", fontWeight: "600", fontSize: 15 },
  voiceButtonTextActive: { color: "#ffffff" },
  messageBubble: { padding: 14, borderRadius: 14 },
  assistantBubble: { backgroundColor: "#E5F0FF" },
  patientBubble: { backgroundColor: "#F2F2F7" },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  messageRole: { color: "#1C1C1E", fontWeight: "600", fontSize: 13 },
  messageText: { marginTop: 6, color: "#3C3C43", fontSize: 15, lineHeight: 22 },
  threadTime: { color: "#8E8E93", fontSize: 12, fontWeight: "400" },
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
    backgroundColor: "#34C759",
  },
  adherenceMissed: {
    backgroundColor: "#FF3B30",
  },
  // Medication checklist
  checklistProgress: {
    gap: 8,
  },
  checklistProgressText: {
    color: "#1C1C1E",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  checklistProgressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F2F2F7",
    overflow: "hidden",
  },
  checklistProgressFill: {
    height: "100%",
    backgroundColor: "#34C759",
  },
  medChecklist: {
    gap: 8,
  },
  medCheckItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
  },
  medCheckItemDone: {
    backgroundColor: "#E3F9E5",
  },
  medCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D1D6",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  medCheckBoxDone: {
    backgroundColor: "#34C759",
    borderColor: "#34C759",
  },
  medCheckMark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  medCheckText: {
    flex: 1,
    color: "#1C1C1E",
    fontSize: 15,
    lineHeight: 20,
  },
  medCheckTextDone: {
    color: "#3C3C43",
    textDecorationLine: "line-through",
  },
  // To-do list (matches medication checklist style)
  todoList: {
    gap: 8,
    marginTop: 6,
  },
  // Voice biomarker guidance
  voiceGuidance: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#E5F0FF",
    gap: 4,
  },
  voiceGuidanceTitle: {
    color: "#0051D5",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  voiceGuidanceItem: {
    color: "#1C1C1E",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  voiceGuidanceFootnote: {
    color: "#3C3C43",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  // Care team card (on hero)
  careTeamCard: {
    marginTop: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    gap: 8,
  },
  careTeamRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  careTeamLabel: {
    color: "#CFE4FF",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  careTeamValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
});
