import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Ellipse, G } from "react-native-svg";
import type { DoctorPlan } from "../lib/showcase";

type OrganKey =
  | "brain"
  | "heart"
  | "lungs"
  | "stomach"
  | "liver"
  | "kidneys"
  | "intestines"
  | "throat";

type OrganStatus = "normal" | "monitor" | "alert";

type OrganState = Record<OrganKey, OrganStatus>;

const KEYWORD_MAP: Record<OrganKey, string[]> = {
  brain: ["brain", "head", "stroke", "migraine", "headache", "concussion", "seizure", "dizzy", "dizziness", "cognitive", "neurologic"],
  heart: ["heart", "cardiac", "chest pain", "palpitation", "arrhythmia", "hypertension", "blood pressure", "coronary"],
  lungs: ["lung", "respiratory", "breath", "breathing", "pneumonia", "asthma", "cough", "shortness of breath", "oxygen", "copd", "bronch"],
  stomach: ["stomach", "nausea", "vomit", "gastric", "ulcer", "reflux", "gerd", "abdominal pain", "upper abdomen"],
  liver: ["liver", "hepatitis", "hepatic", "jaundice", "cirrhosis"],
  kidneys: ["kidney", "renal", "urinary", "uti", "bladder"],
  intestines: ["intestine", "bowel", "colon", "diarrhea", "constipation", "ibs", "gastro", "appendicitis"],
  throat: ["throat", "sore throat", "tonsil", "laryng", "swallow"],
};

function detectOrgans(plan: DoctorPlan): OrganState {
  const normal = (): OrganState => ({
    brain: "normal",
    heart: "normal",
    lungs: "normal",
    stomach: "normal",
    liver: "normal",
    kidneys: "normal",
    intestines: "normal",
    throat: "normal",
  });

  const state = normal();

  const monitorText = [
    plan.diagnosis,
    plan.symptomSummary,
    ...plan.dailyInstructions,
    ...plan.medications,
  ].join(" ").toLowerCase();

  const alertText = plan.redFlags.join(" ").toLowerCase();

  for (const [key, words] of Object.entries(KEYWORD_MAP)) {
    const organ = key as OrganKey;
    if (words.some((w) => alertText.includes(w))) {
      state[organ] = "alert";
    } else if (words.some((w) => monitorText.includes(w))) {
      state[organ] = "monitor";
    }
  }

  return state;
}

function fillFor(status: OrganStatus): string {
  switch (status) {
    case "alert":
      return "#ef4444";
    case "monitor":
      return "#14b8a6";
    default:
      return "#334155";
  }
}

function strokeFor(status: OrganStatus): string {
  switch (status) {
    case "alert":
      return "#fca5a5";
    case "monitor":
      return "#5eead4";
    default:
      return "#475569";
  }
}

function opacityFor(status: OrganStatus): number {
  return status === "normal" ? 0.35 : 0.9;
}

export function AnatomyView({ plan }: { plan: DoctorPlan }) {
  const organs = detectOrgans(plan);

  const affected = (Object.keys(organs) as OrganKey[]).filter(
    (k) => organs[k] !== "normal",
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.svgWrap}>
        <Svg viewBox="0 0 200 380" width="100%" height={380}>
          {/* Body outline */}
          <G>
            {/* Head */}
            <Circle cx="100" cy="32" r="24" fill="none" stroke="#64748b" strokeWidth={1.5} />

            {/* Neck */}
            <Path d="M 92,54 L 92,68 L 108,68 L 108,54" fill="none" stroke="#64748b" strokeWidth={1.5} />

            {/* Torso */}
            <Path
              d="M 70,68 Q 58,70 54,88 L 54,180 Q 54,210 62,230 L 138,230 Q 146,210 146,180 L 146,88 Q 142,70 130,68 Z"
              fill="none"
              stroke="#64748b"
              strokeWidth={1.5}
            />

            {/* Arms */}
            <Path d="M 54,90 Q 40,100 36,140 L 38,200" fill="none" stroke="#64748b" strokeWidth={1.5} />
            <Path d="M 146,90 Q 160,100 164,140 L 162,200" fill="none" stroke="#64748b" strokeWidth={1.5} />

            {/* Pelvis */}
            <Path d="M 62,230 L 68,260 L 132,260 L 138,230" fill="none" stroke="#64748b" strokeWidth={1.5} />

            {/* Legs */}
            <Path d="M 72,260 L 70,340" fill="none" stroke="#64748b" strokeWidth={1.5} />
            <Path d="M 128,260 L 130,340" fill="none" stroke="#64748b" strokeWidth={1.5} />
            <Path d="M 94,260 L 94,340" fill="none" stroke="#64748b" strokeWidth={1.5} />
            <Path d="M 106,260 L 106,340" fill="none" stroke="#64748b" strokeWidth={1.5} />
          </G>

          {/* Brain (inside head) */}
          <G>
            <Path
              d="M 88,24 Q 86,16 94,14 Q 100,10 106,14 Q 114,16 112,24 Q 114,32 108,36 Q 100,40 92,36 Q 86,32 88,24 Z"
              fill={fillFor(organs.brain)}
              fillOpacity={opacityFor(organs.brain)}
              stroke={strokeFor(organs.brain)}
              strokeWidth={1}
            />
            {/* Brain fold lines */}
            <Path d="M 94,20 Q 100,24 106,20" fill="none" stroke={strokeFor(organs.brain)} strokeWidth={0.8} opacity={0.7} />
            <Path d="M 92,28 Q 100,32 108,28" fill="none" stroke={strokeFor(organs.brain)} strokeWidth={0.8} opacity={0.7} />
          </G>

          {/* Throat */}
          <Ellipse
            cx="100"
            cy="60"
            rx="5"
            ry="6"
            fill={fillFor(organs.throat)}
            fillOpacity={opacityFor(organs.throat)}
            stroke={strokeFor(organs.throat)}
            strokeWidth={1}
          />

          {/* Lungs — more anatomical shape */}
          <G>
            {/* Left lung */}
            <Path
              d="M 72,82 Q 64,86 62,100 L 62,150 Q 64,162 74,165 L 88,162 Q 90,150 90,130 L 90,95 Q 86,82 72,82 Z"
              fill={fillFor(organs.lungs)}
              fillOpacity={opacityFor(organs.lungs)}
              stroke={strokeFor(organs.lungs)}
              strokeWidth={1.2}
            />
            {/* Right lung */}
            <Path
              d="M 128,82 Q 136,86 138,100 L 138,150 Q 136,162 126,165 L 112,162 Q 110,150 110,130 L 110,95 Q 114,82 128,82 Z"
              fill={fillFor(organs.lungs)}
              fillOpacity={opacityFor(organs.lungs)}
              stroke={strokeFor(organs.lungs)}
              strokeWidth={1.2}
            />
            {/* Bronchi detail */}
            <Path d="M 100,70 L 100,90 M 100,90 L 86,100 M 100,90 L 114,100" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={1} opacity={0.6} />
            {/* Lung texture */}
            <Path d="M 70,100 Q 76,120 72,140" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={0.6} opacity={0.5} />
            <Path d="M 80,95 Q 82,115 78,135" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={0.6} opacity={0.5} />
            <Path d="M 130,100 Q 124,120 128,140" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={0.6} opacity={0.5} />
            <Path d="M 120,95 Q 118,115 122,135" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={0.6} opacity={0.5} />
          </G>

          {/* Heart — anatomical, tilted slightly left */}
          <G>
            <Path
              d="M 95,108 Q 88,104 86,112 Q 84,122 92,130 L 104,144 L 114,130 Q 120,122 116,114 Q 114,106 107,108 Q 102,110 101,114 Q 100,110 95,108 Z"
              fill={fillFor(organs.heart)}
              fillOpacity={opacityFor(organs.heart)}
              stroke={strokeFor(organs.heart)}
              strokeWidth={1.2}
            />
            {/* Aorta detail */}
            <Path d="M 100,108 Q 102,100 108,102" fill="none" stroke={strokeFor(organs.heart)} strokeWidth={0.8} opacity={0.7} />
          </G>

          {/* Liver — right side, below lungs */}
          <G>
            <Path
              d="M 76,168 Q 70,172 70,184 Q 72,196 82,200 L 118,200 Q 128,196 130,188 Q 128,172 120,168 Z"
              fill={fillFor(organs.liver)}
              fillOpacity={opacityFor(organs.liver)}
              stroke={strokeFor(organs.liver)}
              strokeWidth={1.2}
            />
            <Path d="M 100,172 L 100,198" fill="none" stroke={strokeFor(organs.liver)} strokeWidth={0.8} opacity={0.6} />
          </G>

          {/* Stomach — left side */}
          <G>
            <Path
              d="M 82,178 Q 76,184 78,194 Q 82,204 92,204 L 100,200 L 96,182 Q 90,176 82,178 Z"
              fill={fillFor(organs.stomach)}
              fillOpacity={opacityFor(organs.stomach)}
              stroke={strokeFor(organs.stomach)}
              strokeWidth={1.2}
            />
          </G>

          {/* Kidneys */}
          <G>
            <Ellipse
              cx="80"
              cy="200"
              rx="6"
              ry="10"
              fill={fillFor(organs.kidneys)}
              fillOpacity={opacityFor(organs.kidneys)}
              stroke={strokeFor(organs.kidneys)}
              strokeWidth={1}
            />
            <Ellipse
              cx="120"
              cy="200"
              rx="6"
              ry="10"
              fill={fillFor(organs.kidneys)}
              fillOpacity={opacityFor(organs.kidneys)}
              stroke={strokeFor(organs.kidneys)}
              strokeWidth={1}
            />
          </G>

          {/* Intestines */}
          <G>
            <Path
              d="M 74,208 Q 68,218 72,228 Q 80,236 90,232 Q 100,236 110,232 Q 120,236 128,228 Q 132,218 126,208 L 74,208 Z"
              fill={fillFor(organs.intestines)}
              fillOpacity={opacityFor(organs.intestines)}
              stroke={strokeFor(organs.intestines)}
              strokeWidth={1.2}
            />
            {/* Intestine coils */}
            <Path d="M 80,214 Q 90,220 100,214 Q 110,220 120,214" fill="none" stroke={strokeFor(organs.intestines)} strokeWidth={0.8} opacity={0.6} />
            <Path d="M 80,224 Q 90,218 100,224 Q 110,218 120,224" fill="none" stroke={strokeFor(organs.intestines)} strokeWidth={0.8} opacity={0.6} />
          </G>
        </Svg>
      </View>

      {/* Legend + affected organs list */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: "#14b8a6" }]} />
          <Text style={styles.legendText}>Monitoring</Text>
          <View style={[styles.dot, { backgroundColor: "#ef4444", marginLeft: 16 }]} />
          <Text style={styles.legendText}>Alert</Text>
        </View>

        {affected.length > 0 ? (
          <View style={styles.affectedList}>
            {affected.map((k) => (
              <View
                key={k}
                style={[
                  styles.organChip,
                  organs[k] === "alert" ? styles.alertChip : styles.monitorChip,
                ]}
              >
                <Text
                  style={[
                    styles.organChipText,
                    organs[k] === "alert" ? styles.alertChipText : styles.monitorChipText,
                  ]}
                >
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noIssuesText}>No specific organ systems flagged in your plan.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  svgWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    gap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  affectedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  organChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  monitorChip: {
    backgroundColor: "#134e4a",
    borderWidth: 1,
    borderColor: "#14b8a6",
  },
  alertChip: {
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  organChipText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  monitorChipText: {
    color: "#5eead4",
  },
  alertChipText: {
    color: "#fca5a5",
  },
  noIssuesText: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
});
