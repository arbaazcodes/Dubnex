import type { Variants } from "motion/react";
import {
  type MotionPreset,
  type TransitionOptions,
  transitionFor,
} from "./presets";

export interface ScaleOptions extends TransitionOptions {
  /** Scale when hidden (default 0.98 — very subtle) */
  from?: number;
}

/** Soft scale + fade. No overshoot / bounce. */
export function scaleVariants(
  reducedMotion: boolean | null | undefined,
  options: ScaleOptions = {}
): Variants {
  const from = options.from ?? 0.98;
  const transition = transitionFor(reducedMotion, options);

  if (reducedMotion) {
    return {
      hidden: { opacity: 1, scale: 1 },
      visible: { opacity: 1, scale: 1, transition },
      exit: { opacity: 1, scale: 1, transition },
    };
  }

  return {
    hidden: { opacity: 0, scale: from },
    visible: { opacity: 1, scale: 1, transition },
    exit: { opacity: 0, scale: from, transition },
  };
}

export function scaleIn(
  reducedMotion?: boolean | null,
  preset: MotionPreset = "normal"
) {
  return scaleVariants(reducedMotion, { preset });
}
