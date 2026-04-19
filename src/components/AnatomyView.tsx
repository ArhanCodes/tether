import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Ellipse, G, Line, Rect } from "react-native-svg";
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
  const state: OrganState = {
    brain: "normal",
    heart: "normal",
    lungs: "normal",
    stomach: "normal",
    liver: "normal",
    kidneys: "normal",
    intestines: "normal",
    throat: "normal",
  };

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
    case "alert": return "#ef4444";
    case "monitor": return "#14b8a6";
    default: return "#1e293b";
  }
}

function strokeFor(status: OrganStatus): string {
  switch (status) {
    case "alert": return "#fca5a5";
    case "monitor": return "#5eead4";
    default: return "#334155";
  }
}

function opacityFor(status: OrganStatus): number {
  return status === "normal" ? 0.25 : 0.82;
}

const BONE = "#d1d5db";
const BONE_SHADOW = "#9ca3af";
const BONE_DARK = "#6b7280";

export function AnatomyView({ plan }: { plan: DoctorPlan }) {
  const organs = detectOrgans(plan);
  const affected = (Object.keys(organs) as OrganKey[]).filter((k) => organs[k] !== "normal");

  return (
    <View style={styles.wrapper}>
      <View style={styles.svgWrap}>
        <Svg viewBox="0 0 240 520" width="100%" height={520}>
          {/* ─────────── SKELETON (drawn first, behind organs) ─────────── */}

          {/* Skull */}
          <G>
            {/* Cranium */}
            <Path
              d="M 120,18 Q 98,18 90,38 Q 86,54 90,68 Q 94,78 102,82 L 102,90 Q 100,94 102,98 L 106,102 L 114,102 L 118,100 L 122,100 L 126,102 L 134,102 L 138,98 Q 140,94 138,90 L 138,82 Q 146,78 150,68 Q 154,54 150,38 Q 142,18 120,18 Z"
              fill={BONE}
              stroke={BONE_DARK}
              strokeWidth={0.8}
            />
            {/* Eye sockets */}
            <Ellipse cx="106" cy="54" rx="6" ry="7" fill="#1f2937" stroke={BONE_DARK} strokeWidth={0.6} />
            <Ellipse cx="134" cy="54" rx="6" ry="7" fill="#1f2937" stroke={BONE_DARK} strokeWidth={0.6} />
            {/* Nose cavity */}
            <Path d="M 118,64 L 114,74 L 120,78 L 126,74 L 122,64 Z" fill="#1f2937" stroke={BONE_DARK} strokeWidth={0.6} />
            {/* Teeth/jaw line */}
            <Line x1="106" y1="92" x2="134" y2="92" stroke={BONE_DARK} strokeWidth={0.6} />
            <Line x1="110" y1="92" x2="110" y2="98" stroke={BONE_SHADOW} strokeWidth={0.4} />
            <Line x1="115" y1="92" x2="115" y2="98" stroke={BONE_SHADOW} strokeWidth={0.4} />
            <Line x1="120" y1="92" x2="120" y2="98" stroke={BONE_SHADOW} strokeWidth={0.4} />
            <Line x1="125" y1="92" x2="125" y2="98" stroke={BONE_SHADOW} strokeWidth={0.4} />
            <Line x1="130" y1="92" x2="130" y2="98" stroke={BONE_SHADOW} strokeWidth={0.4} />
          </G>

          {/* Cervical spine (neck vertebrae) */}
          <G>
            {[0, 1, 2, 3].map((i) => (
              <Rect
                key={`cerv-${i}`}
                x="114"
                y={104 + i * 5}
                width="12"
                height="4"
                rx="1.5"
                fill={BONE}
                stroke={BONE_DARK}
                strokeWidth={0.5}
              />
            ))}
          </G>

          {/* Clavicle (collarbones) */}
          <Path d="M 120,126 Q 100,128 82,132" fill="none" stroke={BONE} strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M 120,126 Q 140,128 158,132" fill="none" stroke={BONE} strokeWidth={3.5} strokeLinecap="round" />

          {/* Ribcage */}
          <G>
            {/* Sternum */}
            <Rect x="116" y="130" width="8" height="70" rx="2" fill={BONE} stroke={BONE_DARK} strokeWidth={0.6} />
            <Line x1="116" y1="145" x2="124" y2="145" stroke={BONE_DARK} strokeWidth={0.5} />
            <Line x1="116" y1="160" x2="124" y2="160" stroke={BONE_DARK} strokeWidth={0.5} />
            <Line x1="116" y1="175" x2="124" y2="175" stroke={BONE_DARK} strokeWidth={0.5} />

            {/* Ribs - left side (7 pairs visible) */}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const y = 138 + i * 10;
              const spread = 40 + i * 4;
              return (
                <Path
                  key={`lrib-${i}`}
                  d={`M 116,${y} Q ${116 - spread},${y + 5} ${116 - spread + 4},${y + 16}`}
                  fill="none"
                  stroke={BONE}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              );
            })}
            {/* Ribs - right side */}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const y = 138 + i * 10;
              const spread = 40 + i * 4;
              return (
                <Path
                  key={`rrib-${i}`}
                  d={`M 124,${y} Q ${124 + spread},${y + 5} ${124 + spread - 4},${y + 16}`}
                  fill="none"
                  stroke={BONE}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              );
            })}
          </G>

          {/* Thoracic/Lumbar spine (vertebrae column down the middle) */}
          <G>
            {Array.from({ length: 14 }, (_, i) => (
              <Rect
                key={`vert-${i}`}
                x="116"
                y={200 + i * 7}
                width="8"
                height="5"
                rx="1"
                fill={BONE}
                stroke={BONE_DARK}
                strokeWidth={0.5}
              />
            ))}
          </G>

          {/* Pelvis */}
          <G>
            <Path
              d="M 120,300 Q 88,302 82,322 Q 80,340 92,350 L 108,354 Q 116,350 120,342 Q 124,350 132,354 L 148,350 Q 160,340 158,322 Q 152,302 120,300 Z"
              fill={BONE}
              stroke={BONE_DARK}
              strokeWidth={0.8}
            />
            {/* Pelvic opening */}
            <Path
              d="M 108,320 Q 120,336 132,320 Q 128,344 120,348 Q 112,344 108,320 Z"
              fill="#0f172a"
              stroke={BONE_DARK}
              strokeWidth={0.5}
            />
          </G>

          {/* Shoulder joints */}
          <Circle cx="76" cy="134" r="7" fill={BONE} stroke={BONE_DARK} strokeWidth={0.7} />
          <Circle cx="164" cy="134" r="7" fill={BONE} stroke={BONE_DARK} strokeWidth={0.7} />

          {/* Arms — humerus, radius+ulna */}
          <G>
            {/* Left humerus */}
            <Path d="M 74,140 L 58,215" fill="none" stroke={BONE} strokeWidth={5} strokeLinecap="round" />
            {/* Left elbow */}
            <Circle cx="58" cy="218" r="4" fill={BONE} stroke={BONE_DARK} strokeWidth={0.6} />
            {/* Left radius */}
            <Path d="M 58,222 L 50,288" fill="none" stroke={BONE} strokeWidth={3.5} strokeLinecap="round" />
            {/* Left ulna */}
            <Path d="M 60,222 L 56,288" fill="none" stroke={BONE} strokeWidth={3.5} strokeLinecap="round" />
            {/* Left hand */}
            <Ellipse cx="52" cy="296" rx="8" ry="6" fill={BONE} stroke={BONE_DARK} strokeWidth={0.6} />
            {/* Fingers */}
            {[0, 1, 2, 3].map((i) => (
              <Line key={`lf-${i}`} x1={46 + i * 3} y1="300" x2={45 + i * 3} y2={308 + (i === 1 ? 2 : 0)} stroke={BONE} strokeWidth={1.2} strokeLinecap="round" />
            ))}

            {/* Right humerus */}
            <Path d="M 166,140 L 182,215" fill="none" stroke={BONE} strokeWidth={5} strokeLinecap="round" />
            <Circle cx="182" cy="218" r="4" fill={BONE} stroke={BONE_DARK} strokeWidth={0.6} />
            <Path d="M 182,222 L 190,288" fill="none" stroke={BONE} strokeWidth={3.5} strokeLinecap="round" />
            <Path d="M 180,222 L 184,288" fill="none" stroke={BONE} strokeWidth={3.5} strokeLinecap="round" />
            <Ellipse cx="188" cy="296" rx="8" ry="6" fill={BONE} stroke={BONE_DARK} strokeWidth={0.6} />
            {[0, 1, 2, 3].map((i) => (
              <Line key={`rf-${i}`} x1={182 + i * 3} y1="300" x2={183 + i * 3} y2={308 + (i === 2 ? 2 : 0)} stroke={BONE} strokeWidth={1.2} strokeLinecap="round" />
            ))}
          </G>

          {/* Legs — femur, patella, tibia+fibula */}
          <G>
            {/* Hip joints */}
            <Circle cx="104" cy="348" r="6" fill={BONE} stroke={BONE_DARK} strokeWidth={0.7} />
            <Circle cx="136" cy="348" r="6" fill={BONE} stroke={BONE_DARK} strokeWidth={0.7} />

            {/* Left femur */}
            <Path d="M 104,354 L 96,432" fill="none" stroke={BONE} strokeWidth={6} strokeLinecap="round" />
            {/* Left patella (kneecap) */}
            <Circle cx="95" cy="438" r="5" fill={BONE} stroke={BONE_DARK} strokeWidth={0.7} />
            {/* Left tibia */}
            <Path d="M 94,444 L 90,506" fill="none" stroke={BONE} strokeWidth={4} strokeLinecap="round" />
            {/* Left fibula */}
            <Path d="M 98,444 L 96,506" fill="none" stroke={BONE} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
            {/* Left foot */}
            <Path d="M 84,508 Q 80,514 86,516 L 104,514 Q 108,510 104,506 Z" fill={BONE} stroke={BONE_DARK} strokeWidth={0.6} />

            {/* Right femur */}
            <Path d="M 136,354 L 144,432" fill="none" stroke={BONE} strokeWidth={6} strokeLinecap="round" />
            <Circle cx="145" cy="438" r="5" fill={BONE} stroke={BONE_DARK} strokeWidth={0.7} />
            <Path d="M 146,444 L 150,506" fill="none" stroke={BONE} strokeWidth={4} strokeLinecap="round" />
            <Path d="M 142,444 L 144,506" fill="none" stroke={BONE} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
            <Path d="M 156,508 Q 160,514 154,516 L 136,514 Q 132,510 136,506 Z" fill={BONE} stroke={BONE_DARK} strokeWidth={0.6} />
          </G>

          {/* ─────────── ORGANS (overlaid on skeleton) ─────────── */}

          {/* Brain — inside skull */}
          <G opacity={organs.brain === "normal" ? 0.3 : 1}>
            <Path
              d="M 104,36 Q 100,28 106,24 Q 112,20 118,24 Q 124,20 130,24 Q 136,28 134,36 Q 138,44 134,52 Q 126,60 120,58 Q 114,60 106,52 Q 102,44 104,36 Z"
              fill={fillFor(organs.brain)}
              fillOpacity={opacityFor(organs.brain)}
              stroke={strokeFor(organs.brain)}
              strokeWidth={0.8}
            />
            {/* Brain sulci */}
            <Path d="M 108,32 Q 120,38 132,32" fill="none" stroke={strokeFor(organs.brain)} strokeWidth={0.6} opacity={0.7} />
            <Path d="M 106,42 Q 120,48 134,42" fill="none" stroke={strokeFor(organs.brain)} strokeWidth={0.6} opacity={0.7} />
            <Path d="M 120,24 L 120,58" stroke={strokeFor(organs.brain)} strokeWidth={0.5} opacity={0.5} />
          </G>

          {/* Throat / trachea */}
          <G opacity={organs.throat === "normal" ? 0.3 : 1}>
            <Rect
              x="116"
              y="102"
              width="8"
              height="22"
              rx="2"
              fill={fillFor(organs.throat)}
              fillOpacity={opacityFor(organs.throat)}
              stroke={strokeFor(organs.throat)}
              strokeWidth={0.8}
            />
            {/* Tracheal rings */}
            {[0, 1, 2, 3].map((i) => (
              <Line
                key={`trachea-${i}`}
                x1="116"
                y1={108 + i * 4}
                x2="124"
                y2={108 + i * 4}
                stroke={strokeFor(organs.throat)}
                strokeWidth={0.5}
                opacity={0.6}
              />
            ))}
          </G>

          {/* Lungs — positioned inside ribcage, on either side of sternum */}
          <G opacity={organs.lungs === "normal" ? 0.3 : 1}>
            {/* Left lung */}
            <Path
              d="M 112,132 Q 90,136 80,150 Q 74,170 78,195 Q 82,208 96,210 L 112,208 Q 114,200 114,188 L 114,140 Q 114,134 112,132 Z"
              fill={fillFor(organs.lungs)}
              fillOpacity={opacityFor(organs.lungs)}
              stroke={strokeFor(organs.lungs)}
              strokeWidth={1}
            />
            {/* Right lung */}
            <Path
              d="M 128,132 Q 150,136 160,150 Q 166,170 162,195 Q 158,208 144,210 L 128,208 Q 126,200 126,188 L 126,140 Q 126,134 128,132 Z"
              fill={fillFor(organs.lungs)}
              fillOpacity={opacityFor(organs.lungs)}
              stroke={strokeFor(organs.lungs)}
              strokeWidth={1}
            />
            {/* Bronchi */}
            <Path d="M 120,124 L 120,138 L 108,148 M 120,138 L 132,148" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={0.8} opacity={0.7} />
            {/* Lung texture */}
            <Path d="M 90,150 Q 94,170 90,190" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={0.5} opacity={0.4} />
            <Path d="M 100,145 Q 104,170 100,195" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={0.5} opacity={0.4} />
            <Path d="M 150,150 Q 146,170 150,190" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={0.5} opacity={0.4} />
            <Path d="M 140,145 Q 136,170 140,195" fill="none" stroke={strokeFor(organs.lungs)} strokeWidth={0.5} opacity={0.4} />
          </G>

          {/* Heart — between lungs, slightly left of center, behind ribs */}
          <G opacity={organs.heart === "normal" ? 0.3 : 1}>
            <Path
              d="M 114,162 Q 104,158 102,170 Q 100,184 112,194 L 124,208 L 134,194 Q 142,184 138,172 Q 134,160 124,164 Q 119,166 118,170 Q 117,164 114,162 Z"
              fill={fillFor(organs.heart)}
              fillOpacity={opacityFor(organs.heart)}
              stroke={strokeFor(organs.heart)}
              strokeWidth={1}
            />
            {/* Aorta arch */}
            <Path d="M 120,162 Q 124,152 132,154" fill="none" stroke={strokeFor(organs.heart)} strokeWidth={0.8} opacity={0.7} />
            {/* Ventricle divider */}
            <Path d="M 122,170 L 122,200" stroke={strokeFor(organs.heart)} strokeWidth={0.5} opacity={0.5} />
          </G>

          {/* Liver — right side of abdomen (viewer's left) */}
          <G opacity={organs.liver === "normal" ? 0.3 : 1}>
            <Path
              d="M 96,218 Q 88,222 86,234 Q 88,250 100,254 L 134,254 Q 146,250 148,240 Q 146,222 138,218 Z"
              fill={fillFor(organs.liver)}
              fillOpacity={opacityFor(organs.liver)}
              stroke={strokeFor(organs.liver)}
              strokeWidth={1}
            />
            {/* Liver lobe division */}
            <Path d="M 120,220 L 120,252" stroke={strokeFor(organs.liver)} strokeWidth={0.6} opacity={0.5} />
          </G>

          {/* Stomach — left of center (viewer's right, under left lung) */}
          <G opacity={organs.stomach === "normal" ? 0.3 : 1}>
            <Path
              d="M 102,226 Q 94,232 94,244 Q 96,256 108,258 L 118,254 L 118,232 Q 112,224 102,226 Z"
              fill={fillFor(organs.stomach)}
              fillOpacity={opacityFor(organs.stomach)}
              stroke={strokeFor(organs.stomach)}
              strokeWidth={1}
            />
          </G>

          {/* Kidneys — positioned lower back, either side of spine */}
          <G opacity={organs.kidneys === "normal" ? 0.3 : 1}>
            <Path
              d="M 98,258 Q 92,260 92,272 Q 94,284 102,286 Q 108,282 106,272 Q 104,260 98,258 Z"
              fill={fillFor(organs.kidneys)}
              fillOpacity={opacityFor(organs.kidneys)}
              stroke={strokeFor(organs.kidneys)}
              strokeWidth={1}
            />
            <Path
              d="M 142,258 Q 148,260 148,272 Q 146,284 138,286 Q 132,282 134,272 Q 136,260 142,258 Z"
              fill={fillFor(organs.kidneys)}
              fillOpacity={opacityFor(organs.kidneys)}
              stroke={strokeFor(organs.kidneys)}
              strokeWidth={1}
            />
          </G>

          {/* Intestines — lower abdomen */}
          <G opacity={organs.intestines === "normal" ? 0.3 : 1}>
            <Path
              d="M 92,270 Q 84,286 92,300 Q 104,310 120,306 Q 136,310 148,300 Q 156,286 148,270 L 92,270 Z"
              fill={fillFor(organs.intestines)}
              fillOpacity={opacityFor(organs.intestines)}
              stroke={strokeFor(organs.intestines)}
              strokeWidth={1}
            />
            {/* Intestine coils */}
            <Path d="M 96,278 Q 108,286 120,278 Q 132,286 144,278" fill="none" stroke={strokeFor(organs.intestines)} strokeWidth={0.7} opacity={0.6} />
            <Path d="M 96,290 Q 108,282 120,290 Q 132,282 144,290" fill="none" stroke={strokeFor(organs.intestines)} strokeWidth={0.7} opacity={0.6} />
            <Path d="M 96,300 Q 108,292 120,300 Q 132,292 144,300" fill="none" stroke={strokeFor(organs.intestines)} strokeWidth={0.7} opacity={0.6} />
          </G>
        </Svg>
      </View>

      {/* Legend + affected organs */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: "#14b8a6" }]} />
          <Text style={styles.legendText}>Monitoring</Text>
          <View style={[styles.dot, { backgroundColor: "#ef4444", marginLeft: 16 }]} />
          <Text style={styles.legendText}>Alert</Text>
          <View style={[styles.boneSwatch, { marginLeft: 16 }]} />
          <Text style={styles.legendText}>Skeleton</Text>
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
    gap: 6,
    flexWrap: "wrap",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  boneSwatch: {
    width: 14,
    height: 10,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
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
