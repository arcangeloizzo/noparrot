import React from "react";
import { motion } from "framer-motion";
import { Hand } from "lucide-react";

interface SwipeGestureProps {
  direction: "up" | "left" | "right";
  text?: string;
  className?: string; // Per consentire custom offset senza rompere logiche React
}

export const SwipeGesture = ({ direction, text, className = "" }: SwipeGestureProps) => {
  const getAnimation = () => {
    switch (direction) {
      case "up":
        return {
          y: [40, 0, 0, 40],
          opacity: [0, 1, 0, 0],
        };
      case "left":
        return {
          x: [40, -40, -40, 40],
          opacity: [0, 1, 0, 0],
        };
      case "right":
        return {
          x: [-40, 40, 40, -40],
          opacity: [0, 1, 0, 0],
        };
      default:
        return {};
    }
  };

  return (
    <div className={`absolute inset-x-0 flex flex-col items-center justify-center pointer-events-none z-[105] ${className}`}>
      <motion.div
        animate={getAnimation()}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="flex flex-col items-center gap-4 bg-black/40 backdrop-blur-sm p-6 rounded-3xl"
      >
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
          <Hand className="w-8 h-8 text-white drop-shadow-lg" />
        </div>
        {text && (
          <span className="text-white/90 font-medium text-lg tracking-wide drop-shadow-md">
            {text}
          </span>
        )}
      </motion.div>
    </div>
  );
};
