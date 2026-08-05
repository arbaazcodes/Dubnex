import type { Variants } from "motion/react";
import {
  type MotionPreset,
  type TransitionOptions,
  distances,
  transitionFor,
} from "./presets";

export type SlideAxis = "x" | "y";
export type SlideDirection = "up" | "down" | "left" | "right";

export interface SlideOptions extends TransitionOptions {
  /** Pixel offset (default sm = 8) */
  offset?: number;
  direction?: SlideDirection;
}

function offsetFor(
  direction: SlideDirection,
  offset: number
): { x?: number; y?: number } {
  switch (direction) {
    case "up":
      return { y: offset };
    case "down":
      return { y: -offset };
    case "left":
      return { x: offset };
    case "right":
      return { x: -offset };
    default:
      return { y: offset };
  }
}

/** Subtle slide + fade. */
export function slideVariants(
  reducedMotion: boolean | null | undefined,
  options: SlideOptions = {}
): Variants {
  const direction = options.direction ?? "up";
  const offset = options.offset ?? distances.sm;
  const transition = transitionFor(reducedMotion, options);
  const hiddenOffset = offsetFor(direction, offset);

  if (reducedMotion) {
    return {
      hidden: { opacity: 1, x: 0, y: 0 },
      visible: { opacity: 1, x: 0, y: 0, transition },
      exit: { opacity: 1, x: 0, y: 0, transition },
    };
  }

  return {
    hidden: { opacity: 0, ...hiddenOffset },
    visible: { opacity: 1, x: 0, y: 0, transition },
    exit: {
      opacity: 0,
      ...offsetFor(direction, Math.round(offset * 0.6)),
      transition,
    },
  };
}

export function slideUp(
  reducedMotion?: boolean | null,
  preset: MotionPreset = "normal"
) {
  return slideVariants(reducedMotion, { preset, direction: "up" });
}

export function slideDown(
  reducedMotion?: boolean | null,
  preset: MotionPreset = "normal"
) {
  return slideVariants(reducedMotion, { preset, direction: "down" });
}

export function slideLeft(
  reducedMotion?: boolean | null,
  preset: MotionPreset = "normal"
) {
  return slideVariants(reducedMotion, { preset, direction: "left" });
}

export function slideRight(
  reducedMotion?: boolean | null,
  preset: MotionPreset = "normal"
) {
  return slideVariants(reducedMotion, { preset, direction: "right" });
}
