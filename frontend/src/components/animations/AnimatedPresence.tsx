import {
  AnimatePresence as MotionAnimatePresence,
  type AnimatePresenceProps,
} from "motion/react";
import type { ReactNode } from "react";

export interface AnimatedPresenceProps extends AnimatePresenceProps {
  children: ReactNode;
}

/**
 * Thin wrapper around Motion AnimatePresence for consistent imports.
 * Default mode is sync; pass mode="wait" for page transitions.
 */
export function AnimatedPresence({
  children,
  mode = "sync",
  initial = true,
  ...rest
}: AnimatedPresenceProps) {
  return (
    <MotionAnimatePresence mode={mode} initial={initial} {...rest}>
      {children}
    </MotionAnimatePresence>
  );
}
