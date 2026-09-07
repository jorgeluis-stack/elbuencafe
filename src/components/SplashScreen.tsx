import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  isVisible: boolean;
}

export function SplashScreen({ isVisible }: SplashScreenProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-brand-green-dark"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 rounded-full bg-brand-gold/20 blur-2xl" />
            <img
              src="/assets/logo.png"
              alt="El Buen Café"
              className="relative w-52 h-52 md:w-64 md:h-64 rounded-full ring-2 ring-brand-gold/40 shadow-[0_0_40px_rgba(201,169,110,0.3)]"
            />
          </motion.div>

          <motion.p
            className="mt-6 text-2xl md:text-3xl font-display text-brand-gold tracking-wide"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
          >
            El Buen Café
          </motion.p>

          <motion.div
            className="mt-4 w-24 h-0.5 bg-gradient-to-r from-transparent via-brand-gold to-transparent"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 0.8, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}