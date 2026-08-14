import { create } from 'zustand';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
}

interface NotificationsState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  addNotification: (notification) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: Math.random().toString(36).slice(2),
        timestamp: new Date(),
        read: false,
      };

      return {
        notifications: [newNotification, ...state.notifications].slice(0, 3),
      };
    }),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
    })),
  markAsRead: (id) =>
    set((state) => ({ notifications: state.notifications.map((notification) => notification.id === id ? { ...notification, read: true } : notification) })),
  markAllAsRead: () =>
    set((state) => ({ notifications: state.notifications.map((notification) => ({ ...notification, read: true })) })),
  clearNotifications: () => set({ notifications: [] }),
}));
