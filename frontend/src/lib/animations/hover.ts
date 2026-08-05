import type { HTMLMotionProps } from "motion/react";
import {
  type MotionPreset,
  type TransitionOptions,
  transitionFor,
} from "./presets";

export interface HoverOptions extends TransitionOptions {
  /** Opacity lift on hover (default none — prefer y/scale) */
  opacity?: number;
  /** Vertical nudge in px (default -1) */
  y?: number;
  /** Scale on hover (default 1.01) */
  scale?: number;
}

/**
 * Subtle hover / tap targets. Duration stays short; no spring.
 */
export function hoverMotion(
  reducedMotion: boolean | null | undefined,
  options: HoverOptions = {}
): Pick<HTMLMotionProps<"div">, "whileHover" | "whileTap" | "transition"> {
  const transition = transitionFor(reducedMotion, {
    preset: options.preset ?? "fast",
    ...options,
  });

  if (reducedMotion) {
    return { transition };
  }

  const y = options.y ?? -1;
  const scale = options.scale ?? 1.01;

  return {
    whileHover: {
      y,
      scale,
      ...(typeof options.opacity === "number"
        ? { opacity: options.opacity }
        : {}),
    },
    whileTap: { scale: 0.99, y: 0 },
    transition,
  };
}

export function hoverLift(
  reducedMotion?: boolean | null,
  preset: MotionPreset = "fast"
) {
  return hoverMotion(reducedMotion, { preset, y: -2, scale: 1 });
}

export function hoverScale(
  reducedMotion?: boolean | null,
  preset: MotionPreset = "fast"
) {
  return hoverMotion(reducedMotion, { preset, y: 0, scale: 1.015 });
}
