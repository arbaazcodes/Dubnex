import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { hoverMotion } from "@/lib/animations/hover";
import type { MotionPreset } from "@/lib/animations/presets";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
>;

export interface AnimatedButtonProps extends NativeButtonProps {
  children: ReactNode;
  preset?: MotionPreset;
  /** Disable hover/tap motion */
  staticMotion?: boolean;
  className?: string;
}

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  function AnimatedButton(
    {
      children,
      preset = "fast",
      staticMotion = false,
      className,
      type = "button",
      disabled,
      ...rest
    },
    ref
  ) {
    const reduced = useReducedMotion();
    const hoverProps =
      staticMotion || disabled
        ? {}
        : hoverMotion(reduced, { preset, y: 0, scale: 1.015 });

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(className)}
        {...hoverProps}
        {...rest}
      >
        {children}
      </motion.button>
    );
  }
);
