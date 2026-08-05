import { forwardRef, type ReactNode, type ComponentPropsWithoutRef } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";
import { pageVariants, type PageOptions } from "@/lib/animations/page";
import type { MotionPreset } from "@/lib/animations/presets";

export interface AnimatedPageProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  preset?: MotionPreset;
  direction?: PageOptions["direction"];
  className?: string;
}

/**
 * View / route shell. Pair with AnimatedPresence mode="wait".
 */
export const AnimatedPage = forwardRef<HTMLDivElement, AnimatedPageProps>(
  function AnimatedPage(
    { children, preset = "normal", direction = "fade", className, ...rest },
    ref
  ) {
    const reduced = useReducedMotion();
    const variants = pageVariants(reduced, { preset, direction });

    return (
      <motion.div
        ref={ref}
        className={cn(className)}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
);

export type AnimatedPageHTMLProps = ComponentPropsWithoutRef<typeof AnimatedPage>;
