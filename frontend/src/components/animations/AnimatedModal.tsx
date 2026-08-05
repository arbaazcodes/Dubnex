import { type ReactNode, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  modalBackdropVariants,
  modalContentVariants,
} from "@/lib/animations/modal";
import type { MotionPreset } from "@/lib/animations/presets";
import { AnimatedPresence } from "./AnimatedPresence";

export interface AnimatedModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  preset?: MotionPreset;
  /** Backdrop opacity 0–1 */
  backdropOpacity?: number;
  /** Close when backdrop clicked (default true) */
  closeOnBackdrop?: boolean;
  /** Lock body scroll while open */
  lockScroll?: boolean;
  className?: string;
  contentClassName?: string;
  /** Accessible label */
  "aria-label"?: string;
}

/**
 * Presentational modal shell. No business logic — pass content as children.
 */
export function AnimatedModal({
  open,
  onClose,
  children,
  preset = "fast",
  backdropOpacity = 0.5,
  closeOnBackdrop = true,
  lockScroll = true,
  className,
  contentClassName,
  "aria-label": ariaLabel = "Dialog",
}: AnimatedModalProps) {
  const reduced = useReducedMotion();
  const backdrop = modalBackdropVariants(reduced, { preset, backdropOpacity });
  const content = modalContentVariants(reduced, { preset });

  useEffect(() => {
    if (!lockScroll || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockScroll, open]);

  return (
    <AnimatedPresence>
      {open ? (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4",
            className
          )}
          role="presentation"
        >
          <motion.div
            className="absolute inset-0 bg-black"
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            className={cn("relative z-10 w-full max-w-lg", contentClassName)}
            variants={content}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatedPresence>
  );
}
