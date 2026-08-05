import type { Variants } from "motion/react";
import {
  type MotionPreset,
  type TransitionOptions,
  distances,
  transitionFor,
} from "./presets";

export interface ModalOptions extends TransitionOptions {
  /** Backdrop target opacity */
  backdropOpacity?: number;
}

/** Dialog / overlay content — soft scale, no spring bounce. */
export function modalContentVariants(
  reducedMotion: boolean | null | undefined,
  options: ModalOptions = {}
): Variants {
  const transition = transitionFor(reducedMotion, {
    preset: options.preset ?? "fast",
    ...options,
  });

  if (reducedMotion) {
    return {
      hidden: { opacity: 1, scale: 1, y: 0 },
      visible: { opacity: 1, scale: 1, y: 0, transition },
      exit: { opacity: 1, scale: 1, y: 0, transition },
    };
  }

  return {
    hidden: { opacity: 0, scale: 0.98, y: distances.xs },
    visible: { opacity: 1, scale: 1, y: 0, transition },
    exit: { opacity: 0, scale: 0.98, y: distances.xs, transition },
  };
}

export function modalBackdropVariants(
  reducedMotion: boolean | null | undefined,
  options: ModalOptions = {}
): Variants {
  const opacity = options.backdropOpacity ?? 0.5;
  const transition = transitionFor(reducedMotion, {
    preset: options.preset ?? "fast",
    ...options,
  });

  if (reducedMotion) {
    return {
      hidden: { opacity },
      visible: { opacity, transition },
      exit: { opacity, transition },
    };
  }

  return {
    hidden: { opacity: 0 },
    visible: { opacity, transition },
    exit: { opacity: 0, transition },
  };
}

export function modalPresets(preset: MotionPreset = "fast") {
  return { preset };
}
