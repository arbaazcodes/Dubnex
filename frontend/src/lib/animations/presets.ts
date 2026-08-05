/**
 * Animation presets — Linear / Cursor / Vercel style.
 * Subtle durations, shared easing, no bounce.
 */

export type MotionPreset = "fast" | "normal" | "slow";

/** Cubic-bezier tuples compatible with Motion. */
export const easings = {
  /** Soft decelerate — primary UI motion */
  out: [0.16, 1, 0.3, 1] as const,
  /** Balanced enter/exit */
  inOut: [0.65, 0, 0.35, 1] as const,
  /** Linear (progress, scrubbers) */
  linear: "linear" as const,
} as const;

export const durations = {
  fast: 0.15,
  normal: 0.22,
  slow: 0.36,
} as const satisfies Record<MotionPreset, number>;

export const distances = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export interface TransitionOptions {
  preset?: MotionPreset;
  delay?: number;
  /** Override duration in seconds */
  duration?: number;
}

export function resolveDuration(
  preset: MotionPreset = "normal",
  override?: number
): number {
  if (typeof override === "number") return override;
  return durations[preset];
}

export function baseTransition(options: TransitionOptions = {}) {
  const { preset = "normal", delay = 0, duration } = options;
  return {
    duration: resolveDuration(preset, duration),
    ease: easings.out,
    delay,
  };
}

/** Instant transition when reduced motion is preferred. */
export function reducedTransition(delay = 0) {
  return {
    duration: 0,
    ease: easings.linear,
    delay,
  };
}

export function transitionFor(
  reducedMotion: boolean | null | undefined,
  options: TransitionOptions = {}
) {
  if (reducedMotion) return reducedTransition(options.delay ?? 0);
  return baseTransition(options);
}
