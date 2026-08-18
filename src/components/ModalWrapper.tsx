import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

type ModalChildren = React.ReactNode | (() => React.ReactNode);

interface ModalWrapperProps {
  isOpen: boolean;
  children: ModalChildren;
  cardClass?: string;
  overlayClass?: string;
  z?: string;
  variant?: 'pop' | 'slideUp';
}

const cardVariants = {
  pop: {
    initial: { opacity: 0, scale: 0.92, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.92, y: 20 },
  },
  slideUp: {
    initial: { opacity: 0, y: 100 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 100 },
  },
};

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  isOpen,
  children,
  cardClass = '',
  overlayClass = '',
  z = 'z-50',
  variant = 'pop',
}) => {
  const v = cardVariants[variant];
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 ${z} flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ${overlayClass}`}
        >
          <motion.div
            initial={v.initial}
            animate={v.animate}
            exit={v.exit}
            transition={{ duration: 0.2 }}
            className={cardClass}
          >
            {typeof children === 'function' ? children() : children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
