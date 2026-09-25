'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Search, ChevronDown, Settings, LogOut, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationsStore } from '@/store/notificationsStore';
import { useCommandPaletteStore } from '@/store/commandPaletteStore';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

// Menús anclados a su disparador: escalan desde la esquina superior derecha (no desde el
// centro), entran rápido y salen más rápido.
const POPOVER = {
  initial: { opacity: 0, transform: 'scale(0.97) translateY(-4px)' },
  animate: { opacity: 1, transform: 'scale(1) translateY(0px)', transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, transform: 'scale(0.98) translateY(-2px)', transition: { duration: 0.12 } },
} as const;

const ROL_LEGIBLE: Record<string, string> = {
  admin: 'Administración', encargado: 'Encargado', cajero: 'Caja', cocina: 'Cocina', mozo: 'Salón',
  stock: 'Inventario', delivery: 'Delivery', soporte: 'Soporte', desarrollador: 'Desarrollo',
};

export function Navbar() {
  const router = useRouter();
  const usuario = useAuthStore((state) => state.usuario);
  const logout = useAuthStore((state) => state.logout);
  const openCommandPalette = useCommandPaletteStore((state) => state.open);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifications = useNotificationsStore((state) => state.notifications);
  const removeNotification = useNotificationsStore((state) => state.removeNotification);
  const markAllAsRead = useNotificationsStore((state) => state.markAllAsRead);
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  useEffect(() => {
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) setNotificationsOpen(false);
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setNotificationsOpen(false); setUserMenuOpen(false); }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationsOpen, userMenuOpen]);

  const nombreUsuario = usuario?.nombre ?? 'Administrador';
  const funcionUsuario = ROL_LEGIBLE[usuario?.rol ?? ''] ?? usuario?.rol ?? 'Usuario';
  const iniciales = nombreUsuario.split(' ').map((parte) => parte[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="fixed top-0 left-0 lg:left-[76px] xl:left-[248px] right-0 z-40 flex h-[72px] items-center justify-between gap-3 border-b border-line bg-canvas/80 pl-[4.5rem] pr-4 backdrop-blur-xl sm:pr-6 lg:px-8">
      <button
        type="button"
        onClick={() => openCommandPalette()}
        className="group flex h-11 w-full max-w-[420px] min-w-0 items-center gap-3 rounded-xl border border-line bg-surface px-3.5 text-left shadow-soft transition-colors hover:border-line-strong"
        aria-label="Abrir búsqueda global"
      >
        <Search size={17} className="shrink-0 text-ink-3" />
        <span className="flex-1 truncate text-sm text-ink-3">Buscar mesas, pedidos, platos…</span>
        <kbd className="hidden sm:inline shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-ink-3">⌘K</kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <ThemeToggle />

        <div ref={notificationsRef} className="relative">
          <button
            onClick={() => setNotificationsOpen((open) => !open)}
            className="pressable relative grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:text-ink hover:bg-ink/[0.05]"
            aria-label={unreadNotifications.length ? `Notificaciones, ${unreadNotifications.length} sin leer` : 'Notificaciones'}
            aria-expanded={notificationsOpen}
          >
            <Bell size={19} />
            {unreadNotifications.length > 0 && (
              <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-on-brand ring-2 ring-canvas">
                {unreadNotifications.length}
              </span>
            )}
          </button>
          <AnimatePresence>
            {notificationsOpen && (
              <motion.div {...POPOVER} style={{ transformOrigin: 'top right' }} className="absolute right-0 top-[52px] z-[60] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-float">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm font-medium text-ink">Notificaciones</span>
                  <button onClick={markAllAsRead} disabled={unreadNotifications.length === 0} className="text-xs text-brand-strong hover:underline disabled:text-ink-3 disabled:no-underline">Marcar todas como leídas</button>
                </div>
                {notifications.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-ink-3">Todo al día. Acá vas a ver los pedidos listos para servir.</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => (
                      <li key={notification.id} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read ? 'bg-transparent' : 'bg-brand'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{notification.title}</p>
                          <p className="mt-0.5 text-sm text-ink-3">{notification.message}</p>
                        </div>
                        <button onClick={() => removeNotification(notification.id)} aria-label="Descartar notificación" className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"><X size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={userMenuRef} className="relative">
          <button type="button" onClick={() => setUserMenuOpen((open) => !open)} className="pressable flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 sm:pr-3 hover:bg-ink/[0.05]" aria-expanded={userMenuOpen} aria-haspopup="menu">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{iniciales}</span>
            <span className="hidden sm:block text-left leading-tight">
              <span className="block text-sm font-medium text-ink">{nombreUsuario}</span>
              <span className="block text-xs text-ink-3">{funcionUsuario}</span>
            </span>
            <ChevronDown size={15} className={`hidden sm:block text-ink-3 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div {...POPOVER} style={{ transformOrigin: 'top right' }} className="absolute right-0 top-[52px] z-[60] w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-float" role="menu">
                <div className="px-3 py-2.5 sm:hidden">
                  <p className="text-sm font-medium text-ink">{nombreUsuario}</p>
                  <p className="text-xs text-ink-3">{funcionUsuario}</p>
                </div>
                <button onClick={() => { setUserMenuOpen(false); router.push('/dashboard/administracion?tab=negocio'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink" role="menuitem">
                  <Settings size={16} /> Configuración
                </button>
                <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300" role="menuitem">
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
