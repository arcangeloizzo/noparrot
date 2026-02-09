import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface AnalysisOverlayProps {
    isVisible: boolean;
    message?: string;
}

export const AnalysisOverlay = ({ isVisible, message = "Analisi in corso..." }: AnalysisOverlayProps) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                    <div className="relative">
                        {/* Pulsing rings effect */}
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 0.2, 0.5],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                            className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
                        />

                        {/* Central icon */}
                        <div className="relative bg-background/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-4">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            <motion.p
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-lg font-medium text-white"
                            >
                                {message}
                            </motion.p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
