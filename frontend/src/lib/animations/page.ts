import type { Variants } from "motion/react";
import {
  type MotionPreset,
  type TransitionOptions,
  distances,
  transitionFor,
} from "./presets";

export interface PageOptions extends TransitionOptions {
  /** Enter direction */
  direction?: "fade" | "up" | "left";
}

/**
 * Route / view transitions — short crossfade with optional micro-slide.
 * Designed for AnimatePresence mode="wait".
 */
export function pageVariants(
  reducedMotion: boolean | null | undefined,
  options: PageOptions = {}
): Variants {
  const direction = options.direction ?? "fade";
  const transition = transitionFor(reducedMotion, {
    preset: options.preset ?? "normal",
    ...options,
  });

  if (reducedMotion) {
    return {
      initial: { opacity: 1, x: 0, y: 0 },
      animate: { opacity: 1, x: 0, y: 0, transition },
      exit: { opacity: 1, x: 0, y: 0, transition },
    };
  }

  return {
    initial:
      direction === "up"
        ? { opacity: 0, y: distances.sm }
        : direction === "left"
          ? { opacity: 0, x: distances.sm }
          : { opacity: 0, y: 0 },
    animate: { opacity: 1, x: 0, y: 0, transition },
    exit:
      direction === "up"
        ? { opacity: 0, y: -distances.xs, transition }
        : direction === "left"
          ? { opacity: 0, x: -distances.xs, transition }
          : { opacity: 0, y: 0, transition },
  };
}

export function pageTransition(
  reducedMotion?: boolean | null,
  preset: MotionPreset = "normal"
) {
  return pageVariants(reducedMotion, { preset, direction: "fade" });
}
