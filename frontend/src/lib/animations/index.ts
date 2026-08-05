/**
 * Motion.dev animation system — presets, variants, helpers, and components.
 *
 * Style: Linear / Cursor / Vercel — subtle, no bounce.
 * All variant factories accept `reducedMotion` from `useReducedMotion()`.
 */

export {
  easings,
  durations,
  distances,
  baseTransition,
  reducedTransition,
  transitionFor,
  resolveDuration,
  type MotionPreset,
  type TransitionOptions,
} from "./presets";

export {
  fadeVariants,
  fadeIn,
  fadeDistance,
  type FadeOptions,
} from "./fade";

export {
  slideVariants,
  slideUp,
  slideDown,
  slideLeft,
  slideRight,
  type SlideAxis,
  type SlideDirection,
  type SlideOptions,
} from "./slide";

export { scaleVariants, scaleIn, type ScaleOptions } from "./scale";

export {
  staggerContainer,
  staggerItem,
  staggerGaps,
  staggerDurations,
  type StaggerOptions,
} from "./stagger";

export {
  pageVariants,
  pageTransition,
  type PageOptions,
} from "./page";

export {
  modalContentVariants,
  modalBackdropVariants,
  modalPresets,
  type ModalOptions,
} from "./modal";

export {
  hoverMotion,
  hoverLift,
  hoverScale,
  type HoverOptions,
} from "./hover";

export {
  AnimatedPage,
  AnimatedCard,
  AnimatedButton,
  AnimatedModal,
  AnimatedList,
  AnimatedItem,
  AnimatedPresence,
} from "@/components/animations";

export type {
  AnimatedPageProps,
  AnimatedCardProps,
  AnimatedButtonProps,
  AnimatedModalProps,
  AnimatedListProps,
  AnimatedItemProps,
  AnimatedPresenceProps,
} from "@/components/animations";
