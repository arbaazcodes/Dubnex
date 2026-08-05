import { forwardRef, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { scaleVariants } from "@/lib/animations/scale";
import { slideVariants } from "@/lib/animations/slide";
import { hoverMotion } from "@/lib/animations/hover";
import type { MotionPreset } from "@/lib/animations/presets";

export interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  preset?: MotionPreset;
  /** Enter style */
  enter?: "scale" | "slide" | "none";
  /** Enable subtle hover lift */
  hover?: boolean;
  className?: string;
}

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  function AnimatedCard(
    {
      children,
      preset = "normal",
      enter = "scale",
      hover = false,
      className,
      ...rest
    },
    ref
  ) {
    const reduced = useReducedMotion();
    const variants =
      enter === "slide"
        ? slideVariants(reduced, { preset, direction: "up", offset: 6 })
        : enter === "scale"
          ? scaleVariants(reduced, { preset })
          : undefined;
    const hoverProps = hover
      ? hoverMotion(reduced, { preset: "fast", y: -2, scale: 1 })
      : {};

    return (
      <motion.div
        ref={ref}
        className={cn(className)}
        variants={variants}
        initial={variants ? "hidden" : undefined}
        animate={variants ? "visible" : undefined}
        exit={variants ? "exit" : undefined}
        {...hoverProps}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
);
