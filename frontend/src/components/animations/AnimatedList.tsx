import { forwardRef, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { staggerContainer, type StaggerOptions } from "@/lib/animations/stagger";
import type { MotionPreset } from "@/lib/animations/presets";

export interface AnimatedListProps extends Omit<HTMLMotionProps<"ul">, "children"> {
  children: ReactNode;
  preset?: MotionPreset;
  staggerChildren?: number;
  delayChildren?: number;
  as?: "ul" | "div" | "ol";
  className?: string;
}

/**
 * Parent for staggered children. Wrap items with AnimatedItem.
 */
export const AnimatedList = forwardRef<HTMLElement, AnimatedListProps>(
  function AnimatedList(
    {
      children,
      preset = "normal",
      staggerChildren,
      delayChildren,
      as = "ul",
      className,
      ...rest
    },
    ref
  ) {
    const reduced = useReducedMotion();
    const options: StaggerOptions = { preset, staggerChildren, delayChildren };
    const variants = staggerContainer(reduced, options);
    const Comp = motion[as] as typeof motion.ul;

    return (
      <Comp
        ref={ref as never}
        className={cn(className)}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        {...(rest as object)}
      >
        {children}
      </Comp>
    );
  }
);
