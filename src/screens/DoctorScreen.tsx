import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AnimatedButton } from "../components/AnimatedButton";
import { InputField } from "../components/InputField";
import { SectionCard } from "../components/SectionCard";
import { SummaryPill } from "../components/SummaryPill";
import { FieldLabel } from "../components/FieldLabel";
import {
  addCareMessage,
  buildDoctorStarterDraft,
  getCareMessages,
  getDoctorDraft,
  getPublishedPlans,
  getRecoveryScores,
  normalizeEmail,
  saveDoctorDraft,
  saveSession,
  upsertPublishedPlan,
  type CareMessage,
  type RecoveryScoreResult,
  type UserAccount,
} from "../lib/appData";
import { demoDoctorPlan, summarizePlan, type DoctorPlan } from "../lib/showcase";
import { useLanguage } from "../lib/LanguageContext";
import { tpl } from "../lib/i18n";
import { SectionNav, type NavItem } from "../components/SectionNav";
import type { RootStackParamList } from "../lib/navigationTypes";
import { useScreenScroll } from "../lib/ScrollContext";

type Tone = DoctorPlan["tone"];
type Props = NativeStackScreenProps<RootStackParamList, "DoctorWorkspace">;

// toneLabel is now inside the component to access translations

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function joinLines(items: string[]): string {
  return items.join("\n");
}

function splitLines(value: string): string[] {
  return value.split(/\n+/).map((i) => i.trim()).filter(Boolean);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function DoctorScreen({ navigation, route }: Props) {
  const { user } = route.params;
  const { i } = useLanguage();

  function toneLabel(tone: Tone): string {
    switch (tone) {
      case "calm": return i.calm;
      case "direct": return i.direct;
      case "reassuring": return i.reassuring;
    }
  }

  const [publishedPlans, setPublishedPlans] = useState<DoctorPlan[]>([]);
  const [careMessages, setCareMessages] = useState<CareMessage[]>([]);
  const [draftPlan, setDraftPlan] = useState<DoctorPlan>(demoDoctorPlan);
  const [doctorThreadPatientEmail, setDoctorThreadPatientEmail] = useState("");
  const [doctorReplyInput, setDoctorReplyInput] = useState("");
  const [recoveryScores, setRecoveryScores] = useState<RecoveryScoreResult[]>([]);
  const { registerSection, scrollToSection } = useScreenScroll();

  const navItems: NavItem[] = useMemo(() => [
    { key: "publish", label: i.navPublish },
    { key: "preview", label: i.navPreview },
    { key: "scores", label: i.navScores },
    { key: "account", label: i.navAccount },
    { key: "messages", label: i.navMessages },
  ], [i]);

  useEffect(() => {
    void (async () => {
      try {
        const [plans, msgs, draft, scores] = await Promise.all([
          getPublishedPlans(user.email),
          getCareMessages(user.email),
          getDoctorDraft(user.email),
          getRecoveryScores(user.email).catch(() => [] as RecoveryScoreResult[]),
        ]);
        setPublishedPlans(plans);
        setCareMessages(msgs);
        setRecoveryScores(scores);
        // Load draft: local draft (if it has content) > latest published plan > empty starter
        const myPublished = plans.find(p => normalizeEmail(p.doctorEmail) === normalizeEmail(user.email));
        const hasDraftContent = draft && (draft.diagnosis || draft.symptomSummary || draft.patientName);
        setDraftPlan(
          hasDraftContent ? draft : (myPublished ?? buildDoctorStarterDraft(user)),
        );
      } catch (error) {
        console.error("Failed to load doctor data:", error);
      }
    })();
  }, [user]);

  useEffect(() => {
    void saveDoctorDraft(user.email, draftPlan);
  }, [draftPlan, user.email]);

  const doctorThreadOptions = useMemo(() => {
    const threads = new Map<
      string,
      { patientEmail: string; patientName: string; latestAt: string }
    >();

    for (const msg of careMessages) {
      if (normalizeEmail(msg.doctorEmail) !== normalizeEmail(user.email)) continue;

      const plan = publishedPlans.find(
        (p) =>
          normalizeEmail(p.doctorEmail) === normalizeEmail(user.email) &&
          normalizeEmail(p.patientEmail) === normalizeEmail(msg.patientEmail),
      );

      const current = threads.get(msg.patientEmail);
      if (!current || current.latestAt < msg.createdAt) {
        threads.set(msg.patientEmail, {
          patientEmail: msg.patientEmail,
          patientName: plan?.patientName ?? msg.patientEmail,
          latestAt: msg.createdAt,
        });
      }
    }

    return Array.from(threads.values()).sort((a, b) =>
      b.latestAt.localeCompare(a.latestAt),
    );
  }, [careMessages, user.email, publishedPlans]);

  useEffect(() => {
    if (
      doctorThreadPatientEmail &&
      doctorThreadOptions.some(
        (t) => normalizeEmail(t.patientEmail) === normalizeEmail(doctorThreadPatientEmail),
      )
    )
      return;
    if (doctorThreadOptions.length > 0) {
      setDoctorThreadPatientEmail(doctorThreadOptions[0].patientEmail);
      return;
    }
    if (draftPlan.patientEmail) {
      setDoctorThreadPatientEmail(draftPlan.patientEmail);
    }
  }, [doctorThreadOptions, doctorThreadPatientEmail, draftPlan.patientEmail]);

  const doctorConversation = useMemo(() => {
    if (!doctorThreadPatientEmail) return [];
    return careMessages.filter(
      (msg) =>
        normalizeEmail(msg.doctorEmail) === normalizeEmail(user.email) &&
        normalizeEmail(msg.patientEmail) === normalizeEmail(doctorThreadPatientEmail),
    );
  }, [careMessages, user.email, doctorThreadPatientEmail]);

  function updateField<K extends keyof DoctorPlan>(field: K, value: DoctorPlan[K]) {
    setDraftPlan((cur) => ({ ...cur, [field]: value }));
  }

  function updateListField(
    field: "medications" | "dailyInstructions" | "redFlags",
    value: string,
  ) {
    updateField(field, splitLines(value));
  }

  async function publishPlan() {
    if (!draftPlan.patientName.trim() || !draftPlan.patientEmail.trim()) {
      Alert.alert(i.missingPatient, i.missingPatientMsg);
      return;
    }

    const normalizedPatientEmail = normalizeEmail(draftPlan.patientEmail);
    if (!isValidEmail(normalizedPatientEmail)) {
      Alert.alert(i.invalidPatientEmail, i.invalidPatientEmailMsg);
      return;
    }

    try {
      const nextPlan: DoctorPlan = {
        ...draftPlan,
        doctorName: user.name,
        doctorEmail: user.email,
        patientEmail: normalizedPatientEmail,
        lastUpdatedAt: new Date().toISOString(),
      };

      await upsertPublishedPlan(nextPlan);
      setPublishedPlans(await getPublishedPlans(user.email));
      setDraftPlan(nextPlan);

      Alert.alert(i.planPublished, i.planPublishedMsg);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to publish plan.");
      console.error("Publish error:", error);
    }
  }

  async function loadDoctorStarter() {
    const nextDraft = {
      ...demoDoctorPlan,
      doctorName: user.name,
      doctorEmail: user.email,
      lastUpdatedAt: new Date().toISOString(),
    };
    setDraftPlan(nextDraft);
    await saveDoctorDraft(user.email, nextDraft);
  }

  async function refreshPlans() {
    try {
      setPublishedPlans(await getPublishedPlans(user.email));
      setCareMessages(await getCareMessages(user.email));
      setRecoveryScores(await getRecoveryScores(user.email).catch(() => []));
    } catch (error) {
      Alert.alert(i.refreshFailed, i.refreshFailedMsg);
      console.error("Failed to refresh:", error);
    }
  }

  async function handleLogout() {
    await saveSession(null);
    navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
  }

  async function sendDoctorReply() {
    if (!doctorThreadPatientEmail.trim()) return;
    const body = doctorReplyInput.trim();
    if (!body) return;

    try {
      await addCareMessage({
        doctorEmail: user.email,
        patientEmail: doctorThreadPatientEmail,
        senderRole: "doctor",
        senderName: user.name,
        body,
      });
      setCareMessages(await getCareMessages(user.email));
      setDoctorReplyInput("");
    } catch (error) {
      Alert.alert(i.error, i.sendFailed);
      console.error("Reply error:", error);
    }
  }

  return (
    <>
      <SectionNav items={navItems} onPress={scrollToSection} />

      <View style={styles.heroCard}>
        <Text style={styles.kicker}>{i.doctorWorkspace}</Text>
        <Text style={styles.heroTitle}>{user.name}</Text>
        <Text style={styles.heroText}>
          {i.doctorHeroText}
        </Text>
        <Text style={styles.heroSubtext}>
          {i.doctorHeroSubtext}
        </Text>
        <View style={styles.buttonRow}>
          <AnimatedButton label={i.resetDraft} variant="secondary" onPress={() => void loadDoctorStarter()} />
          <AnimatedButton label={i.logOut} variant="secondary" onPress={() => void handleLogout()} />
        </View>
      </View>

      <View onLayout={(e) => registerSection("publish", e.nativeEvent.layout.y)}>
      <SectionCard title={i.publishPatientPlan} subtitle={i.doctorOnlySubtitle}>
        <View style={styles.buttonRow}>
          <AnimatedButton label={i.publishPlan} variant="primary" onPress={() => void publishPlan()} accessibilityLabel={i.publishPlan} />
          <AnimatedButton label={i.refreshPlans} variant="secondary" onPress={() => void refreshPlans()} />
        </View>

        <View style={styles.dualRow}>
          <InputField label={i.doctorLabel} value={draftPlan.doctorName} onChangeText={(v) => updateField("doctorName", v)} placeholder="Dr. Sana Malik" />
          <InputField label={i.doctorEmail} value={draftPlan.doctorEmail} onChangeText={(v) => updateField("doctorEmail", v)} placeholder="doctor@tether.app" keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={styles.dualRow}>
          <InputField label={i.patientLabel} value={draftPlan.patientName} onChangeText={(v) => updateField("patientName", v)} placeholder="Ava Thompson" />
          <InputField label={i.patientEmail} value={draftPlan.patientEmail} onChangeText={(v) => updateField("patientEmail", v)} placeholder="patient@tether.app" keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={styles.dualRow}>
          <InputField label={i.age} value={draftPlan.age} onChangeText={(v) => updateField("age", v)} placeholder="67" />
          <InputField label={i.diagnosis} value={draftPlan.diagnosis} onChangeText={(v) => updateField("diagnosis", v)} placeholder="Post-discharge pneumonia recovery" />
        </View>

        <InputField label={i.symptomsCondition} value={draftPlan.symptomSummary} onChangeText={(v) => updateField("symptomSummary", v)} placeholder="Fatigue, mild cough..." multiline />

        <View style={styles.quadRow}>
          <InputField label={i.heartRate} value={draftPlan.heartRate} onChangeText={(v) => updateField("heartRate", v)} placeholder="96 bpm" />
          <InputField label={i.bloodPressure} value={draftPlan.bloodPressure} onChangeText={(v) => updateField("bloodPressure", v)} placeholder="126/78 mmHg" />
          <InputField label={i.temperature} value={draftPlan.temperature} onChangeText={(v) => updateField("temperature", v)} placeholder="37.4 C" />
          <InputField label={i.oxygen} value={draftPlan.oxygenSaturation} onChangeText={(v) => updateField("oxygenSaturation", v)} placeholder="93%" />
        </View>

        <InputField label={i.medications} value={joinLines(draftPlan.medications)} onChangeText={(v) => updateListField("medications", v)} placeholder="Amoxicillin 500 mg three times daily" multiline />
        <InputField label={i.dailyInstructions} value={joinLines(draftPlan.dailyInstructions)} onChangeText={(v) => updateListField("dailyInstructions", v)} placeholder="Rest and hydrate" multiline />
        <InputField label={i.redFlags} value={joinLines(draftPlan.redFlags)} onChangeText={(v) => updateListField("redFlags", v)} placeholder="Fever above 38 C" multiline />
        <InputField label={i.followUp} value={draftPlan.followUp} onChangeText={(v) => updateField("followUp", v)} placeholder="Nurse call tomorrow morning" multiline />
        <InputField label={i.dischargeDate} value={draftPlan.dischargeDate ?? ""} onChangeText={(v) => updateField("dischargeDate", v)} placeholder="2026-04-08" />
        <InputField label={i.doctorNoteAI} value={draftPlan.doctorNotes} onChangeText={(v) => updateField("doctorNotes", v)} placeholder="Explain in simple language." multiline />

        <View style={styles.inputGroup}>
          <FieldLabel>{i.patientTone}</FieldLabel>
          <View style={styles.toneRow}>
            {(["calm", "direct", "reassuring"] as Tone[]).map((tone) => (
              <Pressable
                key={tone}
                onPress={() => updateField("tone", tone)}
                style={[styles.toneChip, draftPlan.tone === tone && styles.toneChipActive]}
              >
                <Text style={[styles.toneChipText, draftPlan.tone === tone && styles.toneChipTextActive]}>
                  {toneLabel(tone)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SectionCard>
      </View>

      <View onLayout={(e) => registerSection("preview", e.nativeEvent.layout.y)}>
      <SectionCard title={i.publishedPreview} subtitle={i.publishedPreviewSubtitle}>
        <Text style={styles.previewText}>{summarizePlan(draftPlan)}</Text>
        <View style={styles.previewGrid}>
          <SummaryPill label={i.patientLabel} value={draftPlan.patientName || i.notSet} />
          <SummaryPill label={i.patientEmail} value={draftPlan.patientEmail || i.notSet} />
          <SummaryPill label={i.tone} value={toneLabel(draftPlan.tone)} />
          <SummaryPill label={i.updated} value={formatTimestamp(draftPlan.lastUpdatedAt)} />
        </View>
      </SectionCard>
      </View>

      <View onLayout={(e) => registerSection("scores", e.nativeEvent.layout.y)}>
      <SectionCard title={i.recoveryScores} subtitle={i.recoveryScoresSubtitle}>
        {recoveryScores.length === 0 ? (
          <Text style={styles.previewText}>{i.noScoresYet}</Text>
        ) : (
          recoveryScores.map((s) => {
            const scoreLabel = s.score < 40 ? i.atRisk : s.score < 70 ? i.recovering : i.onTrack;
            const scoreColor = s.score < 40 ? "#ef4444" : s.score < 70 ? "#f59e0b" : "#22c55e";
            return (
              <View key={s.patientEmail} style={styles.scoreCard}>
                <View style={styles.scoreHeader}>
                  <Text style={styles.scorePatient}>{s.patientName}</Text>
                  <View style={[styles.scoreBadge, { backgroundColor: scoreColor + "22" }]}>
                    <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>
                      {s.score}/100 · {scoreLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.scoreBar}>
                  <View style={[styles.scoreBarFill, { width: `${s.score}%`, backgroundColor: scoreColor }]} />
                </View>
                <View style={styles.previewGrid}>
                  <SummaryPill label={i.biomarkerScore} value={`${s.breakdown.biomarker}/30`} />
                  <SummaryPill label={i.adherenceScore} value={`${s.breakdown.adherence}/30`} />
                  <SummaryPill label={i.engagementScore} value={`${s.breakdown.engagement}/20`} />
                  <SummaryPill label={i.journalScore} value={`${s.breakdown.journal}/20`} />
                </View>
              </View>
            );
          })
        )}
      </SectionCard>
      </View>

      <View onLayout={(e) => registerSection("account", e.nativeEvent.layout.y)}>
      <SectionCard title={i.accountSafetyDoctor} subtitle={i.accountSafetyDoctorSubtitle}>
        <View style={styles.previewGrid}>
          <SummaryPill label={i.role} value={i.doctor} />
          <SummaryPill label={i.signedInAs} value={user.email} />
        </View>
        <Text style={styles.previewText}>
          {i.doctorSafetyText}
        </Text>
      </SectionCard>
      </View>

      <View onLayout={(e) => registerSection("messages", e.nativeEvent.layout.y)}>
      <SectionCard title={i.patientMessages} subtitle={i.patientMessagesSubtitle}>
        {doctorThreadOptions.length > 0 ? (
          <>
            <View style={styles.promptWrap}>
              {doctorThreadOptions.map((thread) => (
                <Pressable
                  key={thread.patientEmail}
                  style={[
                    styles.promptChip,
                    normalizeEmail(doctorThreadPatientEmail) === normalizeEmail(thread.patientEmail) && styles.promptChipActive,
                  ]}
                  onPress={() => setDoctorThreadPatientEmail(thread.patientEmail)}
                >
                  <Text
                    style={[
                      styles.promptChipText,
                      normalizeEmail(doctorThreadPatientEmail) === normalizeEmail(thread.patientEmail) && styles.promptChipTextActive,
                    ]}
                  >
                    {thread.patientName}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              style={styles.chatLog}
              contentContainerStyle={styles.chatLogContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {doctorConversation.map((msg) => (
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
              value={doctorReplyInput}
              onChangeText={setDoctorReplyInput}
              placeholder={i.replyPlaceholder}
              placeholderTextColor="#94a3b8"
              style={styles.chatInput}
              multiline
            />

            <AnimatedButton label={i.sendReply} variant="primary" onPress={() => void sendDoctorReply()} accessibilityLabel={i.sendReply} />
          </>
        ) : (
          <Text style={styles.previewText}>
            {i.noPatientMessages}
          </Text>
        )}
      </SectionCard>
      </View>
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
  heroText: {
    color: "#dbeafe",
    fontSize: 15,
    lineHeight: 24,
  },
  heroSubtext: {
    color: "#93c5fd",
    fontSize: 13,
    lineHeight: 20,
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
  dualRow: { gap: 12 },
  quadRow: { gap: 12 },
  inputGroup: { gap: 8 },
  toneRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toneChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  toneChipActive: { backgroundColor: "#1d4ed8" },
  toneChipText: { color: "#334155", fontWeight: "700" },
  toneChipTextActive: { color: "#ffffff" },
  previewText: { color: "#334155", fontSize: 16, lineHeight: 25 },
  previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
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
  chatLog: {
    maxHeight: 360,
    borderRadius: 22,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chatLogContent: { padding: 14, gap: 12 },
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
  scoreCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  scorePatient: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  scoreBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 4,
  },
});
