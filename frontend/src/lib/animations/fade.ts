import type { Variants } from "motion/react";
import {
  type MotionPreset,
  type TransitionOptions,
  distances,
  transitionFor,
} from "./presets";

export interface FadeOptions extends TransitionOptions {
  /** Opacity when hidden (default 0) */
  from?: number;
}

/** Fade opacity variants. */
export function fadeVariants(
  reducedMotion: boolean | null | undefined,
  options: FadeOptions = {}
): Variants {
  const from = options.from ?? 0;
  const transition = transitionFor(reducedMotion, options);

  if (reducedMotion) {
    return {
      hidden: { opacity: 1 },
      visible: { opacity: 1, transition },
      exit: { opacity: 1, transition },
    };
  }

  return {
    hidden: { opacity: from },
    visible: { opacity: 1, transition },
    exit: { opacity: from, transition },
  };
}

export function fadeIn(
  reducedMotion?: boolean | null,
  preset: MotionPreset = "normal"
) {
  return fadeVariants(reducedMotion, { preset });
}

export const fadeDistance = distances;
