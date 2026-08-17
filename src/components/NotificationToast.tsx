import React, { useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { X, Bell } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export const NotificationToast: React.FC = () => {
  const { notifications, clearNotifications } = useOrders();

  // Automatically clear notifications after 8 seconds
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        clearNotifications();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [notifications, clearNotifications]);

  if (notifications.length === 0) return null;

  return (
    <div id="notification-container" className="fixed top-24 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {notifications.slice(0, 3).map((note, idx) => (
          <motion.div
            key={`${idx}-${note.substring(0, 10)}`}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className="pointer-events-auto bg-brand-green-dark/95 border border-brand-crema/30 text-brand-crema rounded-lg shadow-xl p-4 flex items-start gap-3 backdrop-blur-md"
          >
            <div className="bg-brand-crema/10 p-2 rounded-full mt-0.5 text-brand-crema">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1 text-sm font-medium leading-snug">
              {note}
            </div>
            <button
              onClick={clearNotifications}
              className="text-brand-crema/60 hover:text-brand-crema p-1 rounded-full hover:bg-brand-crema/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
