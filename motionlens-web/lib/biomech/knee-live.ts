// UI metadata + browser-side angle math for the knee biomech flow.
// Both flexion and extension use the same hip-knee-ankle interior angle;
// the difference is only the target range and clinical interpretation.

import type { LiveKeypoint as Keypoint } from "@/hooks/usePoseDetectionLive";
import { LM_LIVE as LM } from "@/lib/pose/landmarks-live";

export type KneeMovementId =
  | "flexion"
  | "extension"
  | "flexion_extension"
  | "supine_flexion_extension";

export interface KneeMovement {
  id: string;
  label: string;
  description: string;
  /** Primary direction's normal range. For the merged
   *  flexion_extension test this is the flexion range (peak bend);
   *  for the legacy single tests it's just the test's normal range. */
  target: [number, number];
  /** True for the merged test that captures BOTH flexion and
   *  extension in a single recording. Live and upload modes
   *  track min + max knee angle simultaneously when this is set. */
  merged?: boolean;
  /** Display label for the primary direction in the merged dual
   *  readout / report. */
  primaryLabel?: string;
  /** Display label for the secondary direction. */
  secondaryLabel?: string;
  /** Normal range for the secondary direction. Required when merged.
   *  For knee extension this is the "residual flexion at full
   *  extension" range — lower is better (0° = perfectly straight).
   *  AssessmentReport.classify treats in-range as "good" regardless
   *  of which way is anatomically better. */
  secondaryTarget?: [number, number];
  /** Hidden from the movement chooser. Legacy single-direction entries
   *  are kept in the metadata table so saved reports referencing them
   *  still resolve labels / targets without breaking, but they no
   *  longer appear when starting a new trial. */
  hidden?: boolean;
  /** Deprecated: superseded by the merged test. Still resolvable so
   *  previously SAVED REPORTS that stored this id keep rendering their
   *  label + reference range (see resolveMovement in movements.ts).
   *  Never offered in the chooser and never routed for a new upload —
   *  the upload pages redirect it to the merged equivalent. */
  deprecated?: boolean;
  /** Optional reference illustration. See MovementGrid's
   *  MovementOption.imageUrl for the path convention. */
  imageUrl?: string;
}

export const KNEE_MOVEMENTS: KneeMovement[] = [
  // Combined Flexion + Extension. One recording captures both peaks:
  // the maximum knee bend (flexion) and the residual flexion at the
  // patient's straightest position (extension deficit).
  {
    id: "flexion_extension",
    label: "Flexion + Extension",
    description:
      "Bend the knee fully (peak flexion), then straighten it back to fully extended (peak extension). One session captures both ends of the ROM.",
    target: [125, 145],
    merged: true,
    primaryLabel: "Flexion",
    secondaryLabel: "Extension",
    // Extension target is the residual-flexion range when the knee is
    // "fully extended" — 0° means perfectly straight, lower is better.
    // Range widened from the strict clinical [0, 5] to [0, 10] to
    // absorb the inherent precision limit of 2D pose estimation:
    // MoveNet's hip/knee/ankle keypoint placement carries ~5-10° of
    // systematic noise even when the patient's knee is anatomically
    // straight (the knee keypoint sits near the patella rather than
    // the true joint axis, the hip keypoint near the greater
    // trochanter, etc.). [0, 10] flags genuine extension deficits
    // while not penalising healthy patients for the camera's
    // measurement uncertainty.
    secondaryTarget: [0, 10],
    imageUrl: "/images/biomech/knee/knee_flexion_extension.png",
  },
  // Supine heel slide: patient on the back, side-on to the camera,
  // slides the heel toward the buttock (flexion) and back out straight
  // (extension). Same hip-knee-ankle angle as the seated test; its own
  // compensation checks (heel lift, hip lift) because here the thigh
  // has to move.
  {
    id: "supine_flexion_extension",
    label: "Supine Flexion + Extension (Heel Slide)",
    description:
      "Lying on the back, slide the heel toward the buttock (peak flexion), then slide it back until the leg is straight (peak extension). One session captures both ends of the ROM.",
    target: [125, 145],
    merged: true,
    primaryLabel: "Flexion",
    secondaryLabel: "Extension",
    secondaryTarget: [0, 10],
    imageUrl: "/images/biomech/knee/knee_supine_flexion_extension.png",
  },
  // Legacy single-direction entries — kept so saved reports referring
  // to "flexion" or "extension" alone still resolve a label/target
  // from this table. Hidden from the chooser since the merged entry
  // above is the new default.
  {
    id: "flexion",
    label: "Flexion",
    description: "Bend the knee — bringing the heel toward the buttock",
    target: [125, 145],
    hidden: true,
    deprecated: true,
  },
  {
    id: "extension",
    label: "Extension",
    description: "Straighten a bent knee back to a fully extended leg",
    target: [125, 145],
    hidden: true,
    deprecated: true,
  },
];

const VIS_THRESHOLD = 0.15;

function angleAt(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): number {
  // Interior angle at vertex B for points A-B-C.
  const v1x = ax - bx, v1y = ay - by;
  const v2x = cx - bx, v2y = cy - by;
  const dot = v1x * v2x + v1y * v2y;
  const cross = v1x * v2y - v1y * v2x;
  return (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
}

const SIDE_INDICES = {
  left:  { hip: LM.LEFT_HIP,  knee: LM.LEFT_KNEE,  ankle: LM.LEFT_ANKLE  },
  right: { hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE },
} as const;

export function computeKneeAngle(
  _movement: KneeMovementId,
  keypoints: Keypoint[],
  side: "left" | "right",
): number | null {
  const idx = SIDE_INDICES[side];
  const hip   = keypoints[idx.hip];
  const knee  = keypoints[idx.knee];
  const ankle = keypoints[idx.ankle];
  for (const k of [hip, knee, ankle]) {
    if (!k || (k.score ?? 0) < VIS_THRESHOLD) return null;
  }
  const interior = angleAt(hip.x, hip.y, knee.x, knee.y, ankle.x, ankle.y);
  // Convert interior angle (180° = straight) → flexion-from-straight.
  // 0° flexion = perfectly straight, ~140° = fully bent.
  return 180 - interior;
}

// ─── Compensation detection (Knee FE) — mirror of knee.ts ────────
//
// Same math, same thresholds, same tracker class. Only difference is
// the keypoint source (BlazePose-tfjs LiveKeypoint).

export type CompensationSeverity = "high" | "medium" | "low";

export interface Compensation {
  type: "thigh_movement" | "knee_trunk_lean" | "knee_heel_lift" | "knee_hip_lift";
  label: string;
  severity: CompensationSeverity;
  flagged: boolean;
  details?: string;
}

const KNEE_THIGH_MOVEMENT_THRESHOLD_DEG = 15;
const KNEE_TRUNK_LEAN_THRESHOLD_DEG = 12;
const KNEE_COMPENSATION_BASELINE_FRAME_COUNT = 10;

export function computeKneeThighAngleDeg(
  keypoints: Keypoint[],
  side: "left" | "right",
): number | null {
  const idx = SIDE_INDICES[side];
  const hip = keypoints[idx.hip];
  const knee = keypoints[idx.knee];
  if (!hip || !knee) return null;
  if ((hip.score ?? 0) < VIS_THRESHOLD) return null;
  if ((knee.score ?? 0) < VIS_THRESHOLD) return null;
  const dx = knee.x - hip.x;
  const dy = knee.y - hip.y;
  if (Math.hypot(dx, dy) < 1e-4) return null;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

export function computeKneeTrunkAngleDeg(
  keypoints: Keypoint[],
): number | null {
  const lSh = keypoints[LM.LEFT_SHOULDER];
  const rSh = keypoints[LM.RIGHT_SHOULDER];
  const lHip = keypoints[LM.LEFT_HIP];
  const rHip = keypoints[LM.RIGHT_HIP];
  if (!lSh || !rSh || !lHip || !rHip) return null;
  if ((lSh.score ?? 0) < VIS_THRESHOLD) return null;
  if ((rSh.score ?? 0) < VIS_THRESHOLD) return null;
  if ((lHip.score ?? 0) < VIS_THRESHOLD) return null;
  if ((rHip.score ?? 0) < VIS_THRESHOLD) return null;
  const shMidX = (lSh.x + rSh.x) / 2;
  const shMidY = (lSh.y + rSh.y) / 2;
  const hpMidX = (lHip.x + rHip.x) / 2;
  const hpMidY = (lHip.y + rHip.y) / 2;
  const dx = shMidX - hpMidX;
  const dy = -(shMidY - hpMidY);
  if (Math.hypot(dx, dy) < 1e-4) return null;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

function kneeCompMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

export class KneeFlexExtCompensationTracker {
  private readonly side: "left" | "right";
  private thighSamples: number[] = [];
  private trunkSamples: number[] = [];
  private baselineThigh: number | null = null;
  private baselineTrunk: number | null = null;
  private thighPeakDev = 0;
  private trunkPeakDev = 0;
  private thighFlagged = false;
  private trunkFlagged = false;
  private currentThighActive = false;
  private currentTrunkActive = false;
  private frameCounter = 0;
  private primaryPeakFrame: number | null = null;
  private secondaryPeakFrame: number | null = null;

  constructor(side: "left" | "right") {
    this.side = side;
  }

  feed(keypoints: Keypoint[]): void {
    this.currentThighActive = false;
    this.currentTrunkActive = false;

    const thigh = computeKneeThighAngleDeg(keypoints, this.side);
    const trunk = computeKneeTrunkAngleDeg(keypoints);

    if (thigh !== null
        && this.thighSamples.length < KNEE_COMPENSATION_BASELINE_FRAME_COUNT) {
      this.thighSamples.push(thigh);
      if (this.thighSamples.length === KNEE_COMPENSATION_BASELINE_FRAME_COUNT) {
        this.baselineThigh = kneeCompMean(this.thighSamples);
      }
    }
    if (trunk !== null
        && this.trunkSamples.length < KNEE_COMPENSATION_BASELINE_FRAME_COUNT) {
      this.trunkSamples.push(trunk);
      if (this.trunkSamples.length === KNEE_COMPENSATION_BASELINE_FRAME_COUNT) {
        this.baselineTrunk = kneeCompMean(this.trunkSamples);
      }
    }

    if (thigh !== null && this.baselineThigh !== null) {
      const dev = Math.abs(thigh - this.baselineThigh);
      if (dev > this.thighPeakDev) this.thighPeakDev = dev;
      if (dev > KNEE_THIGH_MOVEMENT_THRESHOLD_DEG) {
        this.thighFlagged = true;
        this.currentThighActive = true;
      }
    }
    if (trunk !== null && this.baselineTrunk !== null) {
      const dev = Math.abs(trunk - this.baselineTrunk);
      if (dev > this.trunkPeakDev) this.trunkPeakDev = dev;
      if (dev > KNEE_TRUNK_LEAN_THRESHOLD_DEG) {
        this.trunkFlagged = true;
        this.currentTrunkActive = true;
      }
    }

    this.frameCounter += 1;
  }

  markPrimaryPeak(): void {
    this.primaryPeakFrame = Math.max(0, this.frameCounter - 1);
  }

  markSecondaryPeak(): void {
    this.secondaryPeakFrame = Math.max(0, this.frameCounter - 1);
  }

  currentFlags(): Compensation[] {
    const out: Compensation[] = [];
    if (this.currentThighActive) {
      out.push({ type: "thigh_movement", label: "Thigh Movement", severity: "high", flagged: true });
    }
    if (this.currentTrunkActive) {
      out.push({ type: "knee_trunk_lean", label: "Trunk Lean", severity: "medium", flagged: true });
    }
    return out;
  }

  finish(): Compensation[] {
    return [
      {
        type: "thigh_movement",
        label: "Thigh Movement",
        severity: "high",
        flagged: this.thighFlagged,
        details: `Peak thigh-angle deviation ${this.thighPeakDev.toFixed(1)}° from baseline (threshold ${KNEE_THIGH_MOVEMENT_THRESHOLD_DEG}°)`,
      },
      {
        type: "knee_trunk_lean",
        label: "Trunk Lean",
        severity: "medium",
        flagged: this.trunkFlagged,
        details: `Peak trunk-angle deviation ${this.trunkPeakDev.toFixed(1)}° from baseline (threshold ${KNEE_TRUNK_LEAN_THRESHOLD_DEG}°)`,
      },
    ];
  }
}

// ─── Supine heel slide compensations ─────────────────────────────
// Patient on the back, side-on. The thigh has to move and the trunk
// stays flat, so the seated checks don't apply. Flag the two usual
// cheats instead, as a share of the baseline hip→ankle leg length
// (image y grows downward). Mirrors _track_supine_knee_compensations
// in engines/biomech/knee_engine.py.
const SUPINE_HEEL_LIFT_FRAC = 0.15;
const SUPINE_HIP_LIFT_FRAC = 0.08;

export class SupineKneeCompensationTracker {
  private readonly side: "left" | "right";
  private hipSamples: number[] = [];
  private ankleSamples: number[] = [];
  private legSamples: number[] = [];
  private baseHipY: number | null = null;
  private baseAnkleY: number | null = null;
  private legLen: number | null = null;
  private heelPeak = 0;
  private hipPeak = 0;
  private currentHeel = false;
  private currentHip = false;

  constructor(side: "left" | "right") {
    this.side = side;
  }

  feed(keypoints: Keypoint[]): void {
    this.currentHeel = false;
    this.currentHip = false;
    const idx = SIDE_INDICES[this.side];
    const hip = keypoints[idx.hip];
    const ankle = keypoints[idx.ankle];
    if (!hip || !ankle) return;
    if ((hip.score ?? 0) < VIS_THRESHOLD || (ankle.score ?? 0) < VIS_THRESHOLD) return;
    if (this.baseHipY === null) {
      this.hipSamples.push(hip.y);
      this.ankleSamples.push(ankle.y);
      this.legSamples.push(Math.hypot(ankle.x - hip.x, ankle.y - hip.y));
      if (this.hipSamples.length === KNEE_COMPENSATION_BASELINE_FRAME_COUNT) {
        this.baseHipY = kneeCompMean(this.hipSamples);
        this.baseAnkleY = kneeCompMean(this.ankleSamples);
        this.legLen = kneeCompMean(this.legSamples);
      }
      return;
    }
    if (!this.legLen || this.legLen < 1e-3 || this.baseAnkleY === null) return;
    const heel = (this.baseAnkleY - ankle.y) / this.legLen;
    const hipLift = (this.baseHipY - hip.y) / this.legLen;
    if (heel > this.heelPeak) this.heelPeak = heel;
    if (hipLift > this.hipPeak) this.hipPeak = hipLift;
    this.currentHeel = heel > SUPINE_HEEL_LIFT_FRAC;
    this.currentHip = hipLift > SUPINE_HIP_LIFT_FRAC;
  }

  // Same surface as KneeFlexExtCompensationTracker so the live page
  // can hold either.
  markPrimaryPeak(): void {}

  markSecondaryPeak(): void {}

  currentFlags(): Compensation[] {
    const out: Compensation[] = [];
    if (this.currentHeel) {
      out.push({ type: "knee_heel_lift", label: "Heel Lift", severity: "medium", flagged: true });
    }
    if (this.currentHip) {
      out.push({ type: "knee_hip_lift", label: "Hip Lift", severity: "medium", flagged: true });
    }
    return out;
  }

  finish(): Compensation[] {
    return [
      {
        type: "knee_heel_lift",
        label: "Heel Lift",
        severity: "medium",
        flagged: this.heelPeak > SUPINE_HEEL_LIFT_FRAC,
        details: `Peak heel lift ${(this.heelPeak * 100).toFixed(0)}% of leg length (threshold ${(SUPINE_HEEL_LIFT_FRAC * 100).toFixed(0)}%)`,
      },
      {
        type: "knee_hip_lift",
        label: "Hip Lift",
        severity: "medium",
        flagged: this.hipPeak > SUPINE_HIP_LIFT_FRAC,
        details: `Peak hip lift ${(this.hipPeak * 100).toFixed(0)}% of leg length (threshold ${(SUPINE_HIP_LIFT_FRAC * 100).toFixed(0)}%)`,
      },
    ];
  }
}
