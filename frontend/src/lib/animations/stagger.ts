import type { Variants } from "motion/react";
import {
  type MotionPreset,
  type TransitionOptions,
  durations,
  transitionFor,
} from "./presets";
import { fadeVariants } from "./fade";
import { slideVariants } from "./slide";

export interface StaggerOptions extends TransitionOptions {
  /** Delay between children (seconds) */
  staggerChildren?: number;
  /** Delay before first child */
  delayChildren?: number;
  /** Child motion style */
  child?: "fade" | "slide";
}

export function staggerContainer(
  reducedMotion: boolean | null | undefined,
  options: StaggerOptions = {}
): Variants {
  const preset = options.preset ?? "normal";
  const staggerChildren = reducedMotion
    ? 0
    : (options.staggerChildren ??
      (preset === "fast" ? 0.03 : preset === "slow" ? 0.08 : 0.05));
  const delayChildren = reducedMotion ? 0 : (options.delayChildren ?? 0);
  const transition = transitionFor(reducedMotion, options);

  return {
    hidden: {},
    visible: {
      transition: {
        ...transition,
        staggerChildren,
        delayChildren,
      },
    },
    exit: {
      transition: {
        ...transition,
        staggerChildren: reducedMotion ? 0 : staggerChildren / 2,
        staggerDirection: -1,
      },
    },
  };
}

export function staggerItem(
  reducedMotion: boolean | null | undefined,
  options: StaggerOptions = {}
): Variants {
  const child = options.child ?? "slide";
  if (child === "fade") {
    return fadeVariants(reducedMotion, options);
  }
  return slideVariants(reducedMotion, {
    ...options,
    direction: "up",
    offset: 6,
  });
}

/** Suggested stagger gaps by preset. */
export const staggerGaps: Record<MotionPreset, number> = {
  fast: 0.03,
  normal: 0.05,
  slow: 0.08,
};

export const staggerDurations = durations;
