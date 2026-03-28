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
  getUsers,
  normalizeEmail,
  saveDoctorDraft,
  saveSession,
  upsertPublishedPlan,
  type CareMessage,
  type UserAccount,
} from "../lib/appData";
import { demoDoctorPlan, summarizePlan, type DoctorPlan } from "../lib/showcase";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Tone = DoctorPlan["tone"];
type Props = NativeStackScreenProps<RootStackParamList, "DoctorWorkspace">;

function toneLabel(tone: Tone): string {
  switch (tone) {
    case "calm": return "Calm";
    case "direct": return "Direct";
    case "reassuring": return "Reassuring";
  }
}

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

  const [publishedPlans, setPublishedPlans] = useState<DoctorPlan[]>([]);
  const [careMessages, setCareMessages] = useState<CareMessage[]>([]);
  const [draftPlan, setDraftPlan] = useState<DoctorPlan>(demoDoctorPlan);
  const [doctorThreadPatientEmail, setDoctorThreadPatientEmail] = useState("");
  const [doctorReplyInput, setDoctorReplyInput] = useState("");
  const [users, setUsers] = useState<UserAccount[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [plans, msgs, draft, allUsers] = await Promise.all([
          getPublishedPlans(),
          getCareMessages(),
          getDoctorDraft(user.email),
          getUsers(),
        ]);
        setPublishedPlans(plans);
        setCareMessages(msgs);
        setUsers(allUsers);
        setDraftPlan(
          draft ?? {
            ...buildDoctorStarterDraft(user),
            patientName: "Ava Thompson",
            patientEmail: "patient@tether.app",
          },
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
      Alert.alert(
        "Missing patient details",
        "Add the patient name and patient email before publishing the plan.",
      );
      return;
    }

    const normalizedPatientEmail = normalizeEmail(draftPlan.patientEmail);
    if (!isValidEmail(normalizedPatientEmail)) {
      Alert.alert("Invalid patient email", "Enter a valid patient email address.");
      return;
    }

    const patientAccount = users.find(
      (u) => u.role === "patient" && normalizeEmail(u.email) === normalizedPatientEmail,
    );

    if (!patientAccount) {
      Alert.alert(
        "Patient account not found",
        "Create the patient account first, then publish the plan to that patient email.",
      );
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

      const nextPlans = await upsertPublishedPlan(nextPlan);
      setPublishedPlans(nextPlans);
      setDraftPlan(nextPlan);

      Alert.alert(
        "Plan published",
        "The assigned patient can now see this plan after logging in.",
      );
    } catch (error) {
      Alert.alert("Error", "Failed to publish plan. Please try again.");
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
      setPublishedPlans(await getPublishedPlans());
      setCareMessages(await getCareMessages());
    } catch (error) {
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
      const nextMessages = await addCareMessage({
        doctorEmail: user.email,
        patientEmail: doctorThreadPatientEmail,
        senderRole: "doctor",
        senderName: user.name,
        body,
      });
      setCareMessages(nextMessages);
      setDoctorReplyInput("");
    } catch (error) {
      Alert.alert("Error", "Failed to send reply.");
      console.error("Reply error:", error);
    }
  }

  return (
    <>
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>Doctor Workspace</Text>
        <Text style={styles.heroTitle}>{user.name}</Text>
        <Text style={styles.heroText}>
          Logged in as {user.email}. Publish a plan for a patient email and that
          patient account will see it after login.
        </Text>
        <Text style={styles.heroSubtext}>
          Publishing is locked to real patient accounts so plans are not sent into the wrong inbox.
        </Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={() => void loadDoctorStarter()}>
            <Text style={styles.secondaryButtonText}>Reset Draft</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void handleLogout()}>
            <Text style={styles.secondaryButtonText}>Log Out</Text>
          </Pressable>
        </View>
      </View>

      <SectionCard title="Publish Patient Plan" subtitle="This screen is only for doctor accounts.">
        <View style={styles.buttonRow}>
          <Pressable style={styles.primaryButton} onPress={() => void publishPlan()}>
            <Text style={styles.primaryButtonText}>Publish Plan</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void refreshPlans()}>
            <Text style={styles.secondaryButtonText}>Refresh Plans</Text>
          </Pressable>
        </View>

        <View style={styles.dualRow}>
          <InputField label="Doctor" value={draftPlan.doctorName} onChangeText={(v) => updateField("doctorName", v)} placeholder="Dr. Sana Malik" />
          <InputField label="Doctor email" value={draftPlan.doctorEmail} onChangeText={(v) => updateField("doctorEmail", v)} placeholder="doctor@tether.app" keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={styles.dualRow}>
          <InputField label="Patient" value={draftPlan.patientName} onChangeText={(v) => updateField("patientName", v)} placeholder="Ava Thompson" />
          <InputField label="Patient email" value={draftPlan.patientEmail} onChangeText={(v) => updateField("patientEmail", v)} placeholder="patient@tether.app" keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={styles.dualRow}>
          <InputField label="Age" value={draftPlan.age} onChangeText={(v) => updateField("age", v)} placeholder="67" />
          <InputField label="Diagnosis" value={draftPlan.diagnosis} onChangeText={(v) => updateField("diagnosis", v)} placeholder="Post-discharge pneumonia recovery" />
        </View>

        <InputField label="Symptoms and condition" value={draftPlan.symptomSummary} onChangeText={(v) => updateField("symptomSummary", v)} placeholder="Fatigue, mild cough..." multiline />

        <View style={styles.quadRow}>
          <InputField label="Heart Rate" value={draftPlan.heartRate} onChangeText={(v) => updateField("heartRate", v)} placeholder="96 bpm" />
          <InputField label="Blood Pressure" value={draftPlan.bloodPressure} onChangeText={(v) => updateField("bloodPressure", v)} placeholder="126/78 mmHg" />
          <InputField label="Temperature" value={draftPlan.temperature} onChangeText={(v) => updateField("temperature", v)} placeholder="37.4 C" />
          <InputField label="Oxygen" value={draftPlan.oxygenSaturation} onChangeText={(v) => updateField("oxygenSaturation", v)} placeholder="93%" />
        </View>

        <InputField label="Medications (one per line)" value={joinLines(draftPlan.medications)} onChangeText={(v) => updateListField("medications", v)} placeholder="Amoxicillin 500 mg three times daily" multiline />
        <InputField label="Daily instructions (one per line)" value={joinLines(draftPlan.dailyInstructions)} onChangeText={(v) => updateListField("dailyInstructions", v)} placeholder="Rest and hydrate" multiline />
        <InputField label="Red flags (one per line)" value={joinLines(draftPlan.redFlags)} onChangeText={(v) => updateListField("redFlags", v)} placeholder="Fever above 38 C" multiline />
        <InputField label="Follow-up" value={draftPlan.followUp} onChangeText={(v) => updateField("followUp", v)} placeholder="Nurse call tomorrow morning" multiline />
        <InputField label="Doctor note for AI tone" value={draftPlan.doctorNotes} onChangeText={(v) => updateField("doctorNotes", v)} placeholder="Explain in simple language." multiline />

        <View style={styles.inputGroup}>
          <FieldLabel>Patient-facing tone</FieldLabel>
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

      <SectionCard title="Published Plan Preview" subtitle="This is what the patient companion will summarize.">
        <Text style={styles.previewText}>{summarizePlan(draftPlan)}</Text>
        <View style={styles.previewGrid}>
          <SummaryPill label="Patient" value={draftPlan.patientName || "Not set"} />
          <SummaryPill label="Patient Email" value={draftPlan.patientEmail || "Not set"} />
          <SummaryPill label="Tone" value={toneLabel(draftPlan.tone)} />
          <SummaryPill label="Updated" value={formatTimestamp(draftPlan.lastUpdatedAt)} />
        </View>
      </SectionCard>

      <SectionCard title="Account & Safety" subtitle="Release-facing product guardrails for the doctor workspace.">
        <View style={styles.previewGrid}>
          <SummaryPill label="Role" value="Doctor" />
          <SummaryPill label="Signed in as" value={user.email} />
        </View>
        <Text style={styles.previewText}>
          Do not use this app as a replacement for emergency escalation, diagnosis,
          or unmanaged medical decision-making. Published plans should be reviewed
          for accuracy before release to the patient.
        </Text>
      </SectionCard>

      <SectionCard title="Patient Messages" subtitle="Patients can ask for human help here when AI is not enough.">
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
              placeholder="Reply to this patient..."
              placeholderTextColor="#7b8f88"
              style={styles.chatInput}
              multiline
            />

            <Pressable style={styles.primaryButton} onPress={() => void sendDoctorReply()}>
              <Text style={styles.primaryButtonText}>Send Reply</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.previewText}>
            No patient messages yet. Once a patient asks for help, the conversation will appear here.
          </Text>
        )}
      </SectionCard>
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
  heroText: {
    color: "#adc1bb",
    fontSize: 15,
    lineHeight: 24,
  },
  heroSubtext: {
    color: "#85a09a",
    fontSize: 13,
    lineHeight: 20,
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
  dualRow: { gap: 12 },
  quadRow: { gap: 12 },
  inputGroup: { gap: 8 },
  toneRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toneChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e2d9c8",
  },
  toneChipActive: { backgroundColor: "#10211d" },
  toneChipText: { color: "#10211d", fontWeight: "700" },
  toneChipTextActive: { color: "#f7f3e9" },
  previewText: { color: "#243631", fontSize: 16, lineHeight: 25 },
  previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  promptWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  promptChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e2d9c8",
  },
  promptChipActive: { backgroundColor: "#10211d" },
  promptChipText: { color: "#10211d", fontWeight: "700" },
  promptChipTextActive: { color: "#f6f1e5" },
  chatLog: {
    maxHeight: 360,
    borderRadius: 22,
    backgroundColor: "#fbf8ef",
    borderWidth: 1,
    borderColor: "#d8ceb9",
  },
  chatLogContent: { padding: 14, gap: 12 },
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
});
