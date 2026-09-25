'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import {
  useNotificationsStore,
  type Notification,
} from '@/store/notificationsStore';

export function ToastContainer() {
  const notifications = useNotificationsStore((state) => state.notifications);

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-label="Notificaciones"
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((item) => (
          <ToastItem key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ item }: { item: Notification }) {
  const removeNotification = useNotificationsStore((state) => state.removeNotification);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      removeNotification(item.id);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [item.id, removeNotification]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, transform: 'translateY(16px) scale(0.97)' }}
      animate={{ opacity: 1, transform: 'translateY(0px) scale(1)', transition: { duration: 0.32, ease: [0.23, 1, 0.32, 1] } }}
      exit={{ opacity: 0, transform: 'translateY(12px) scale(0.98)', transition: { duration: 0.18 } }}
      className="pointer-events-auto flex items-start gap-3 max-w-sm rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-float"
      role="status"
    >
      <ToastIcon type={item.type} />

      <div className="flex-1 overflow-hidden">
        <p className="font-medium text-ink">{item.title}</p>
        {item.message && <p className="mt-0.5 line-clamp-2 leading-snug text-ink-3">{item.message}</p>}
      </div>

      <button
        onClick={() => removeNotification(item.id)}
        className="flex-shrink-0 grid h-7 w-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="Cerrar notificación"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

function ToastIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'success':
      return <CheckCircle size={18} className="text-green-700 dark:text-green-400 flex-shrink-0" />;
    case 'error':
      return <XCircle size={18} className="text-red-700 dark:text-red-400 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle size={18} className="text-yellow-700 dark:text-yellow-400 flex-shrink-0" />;
    case 'info':
    default:
      return <Info size={18} className="text-blue-700 dark:text-blue-400 flex-shrink-0" />;
  }
}

function notify(type: Notification['type'], title: string, message = '') {
  useNotificationsStore.getState().addNotification({ title, message, type });
}

export const toast = {
  success: (title: string, message?: string) => notify('success', title, message),
  error: (title: string, message?: string) => notify('error', title, message),
  warning: (title: string, message?: string) => notify('warning', title, message),
  info: (title: string, message?: string) => notify('info', title, message),
};
