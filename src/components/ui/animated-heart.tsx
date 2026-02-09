
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedHeartProps {
    isVisible: boolean;
    onAnimationComplete?: () => void;
    size?: number;
    className?: string;
}

export const AnimatedHeart = ({
    isVisible,
    onAnimationComplete,
    size = 100,
    className
}: AnimatedHeartProps) => {
    return (
        <AnimatePresence onExitComplete={onAnimationComplete}>
            {isVisible && (
                <motion.div
                    initial={{ scale: 0, rotate: -15, opacity: 0 }}
                    animate={{
                        scale: 1,
                        rotate: 0,
                        opacity: 1,
                        transition: {
                            type: "spring",
                            stiffness: 400,
                            damping: 15,
                            mass: 0.8
                        }
                    }}
                    exit={{
                        scale: 1.5,
                        opacity: 0,
                        transition: { duration: 0.3 }
                    }}
                    className={cn(
                        "absolute pointer-events-none drop-shadow-xl z-50 flex items-center justify-center",
                        className
                    )}
                    style={{
                        width: size,
                        height: size,
                        left: "50%",
                        top: "50%",
                        marginLeft: -size / 2,
                        marginTop: -size / 2,
                    }}
                >
                    <Heart
                        fill="white"
                        stroke="white"
                        size={size}
                        className="text-white drop-shadow-lg"
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};
