"use client";

import { motion, type Transition } from "framer-motion";

const spring: Transition = { type: "spring", stiffness: 420, damping: 28 };

export function InteractiveButtonWrap({
  children,
  disabled,
  fullWidth,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  if (disabled) {
    return <>{children}</>;
  }
  return (
    <motion.span
      whileHover={{ scale: 1.02, transition: spring }}
      whileTap={{ scale: 0.98, transition: { duration: 0.12 } }}
      style={{
        display: fullWidth ? "block" : "inline-block",
        width: fullWidth ? "100%" : undefined,
      }}
    >
      {children}
    </motion.span>
  );
}

export function HoverLift({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return <>{children}</>;
  }
  return (
    <motion.div
      whileHover={{
        y: -4,
        transition: spring,
      }}
      whileTap={{ scale: 0.985, transition: { duration: 0.12 } }}
      style={{ height: "100%" }}
    >
      {children}
    </motion.div>
  );
}

export function HoverPaperGlow({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{
        boxShadow: "0 0 0 1px rgba(124,108,245,0.35), 0 12px 36px rgba(0,0,0,0.35)",
        y: -2,
        transition: { duration: 0.22 },
      }}
      style={{ width: "100%", borderRadius: 12 }}
    >
      {children}
    </motion.div>
  );
}
