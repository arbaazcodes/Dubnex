import { forwardRef, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { staggerItem, type StaggerOptions } from "@/lib/animations/stagger";
import type { MotionPreset } from "@/lib/animations/presets";

export interface AnimatedItemProps extends Omit<HTMLMotionProps<"li">, "children"> {
  children: ReactNode;
  preset?: MotionPreset;
  child?: StaggerOptions["child"];
  as?: "li" | "div";
  className?: string;
}

/** Child of AnimatedList — inherits stagger timing from parent. */
export const AnimatedItem = forwardRef<HTMLElement, AnimatedItemProps>(
  function AnimatedItem(
    {
      children,
      preset = "normal",
      child = "slide",
      as = "li",
      className,
      ...rest
    },
    ref
  ) {
    const reduced = useReducedMotion();
    const variants = staggerItem(reduced, { preset, child });
    const Comp = motion[as] as typeof motion.li;

    return (
      <Comp
        ref={ref as never}
        className={cn(className)}
        variants={variants}
        {...(rest as object)}
      >
        {children}
      </Comp>
    );
  }
);
