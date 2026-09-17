'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, ChevronDown, Settings, LogOut, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationsStore } from '@/store/notificationsStore';
import { useCommandPaletteStore } from '@/store/commandPaletteStore';

export function Navbar() {
  const router = useRouter();
  const usuario = useAuthStore((state) => state.usuario);
  const logout = useAuthStore((state) => state.logout);
  const openCommandPalette = useCommandPaletteStore((state) => state.open);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const notifications = useNotificationsStore((state) => state.notifications);
  const removeNotification = useNotificationsStore((state) => state.removeNotification);
  const markAsRead = useNotificationsStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationsStore((state) => state.markAllAsRead);
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  useEffect(() => {
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) setNotificationsOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [notificationsOpen]);

  const nombreUsuario = usuario?.nombre ?? 'Administrador';
  const funcionUsuario = usuario?.rol === 'admin' ? 'Administrador' : usuario?.rol ?? 'Usuario';
  const iniciales = nombreUsuario.split(' ').map((parte) => parte[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="fixed top-0 left-0 lg:left-20 right-0 h-[72px] bg-[#131313]/85 border-b border-[#1d2b21] px-4 pl-16 sm:px-6 sm:pl-20 lg:px-10 flex items-center justify-between z-40 backdrop-blur-xl">
      <div className="flex items-center min-w-0 flex-1">
        <button
          type="button"
          onClick={() => openCommandPalette()}
          className="relative flex items-center bg-[#201f1f] h-11 px-4 sm:px-6 rounded-full w-full max-w-[400px] hover:bg-[#242424] transition-colors text-left"
          aria-label="Abrir búsqueda global"
        >
          <Search size={20} className="text-[#8b938d] mr-3 flex-shrink-0" />
          <span className="flex-1 min-w-0 text-sm sm:text-base text-[#8b938d]/60 truncate">Buscar secciones, mesas, pedidos o platos...</span>
          <kbd className="hidden sm:inline text-[10px] text-[#8b938d] border border-[#333] rounded px-1.5 py-0.5 flex-shrink-0">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-4 lg:gap-7 ml-4">
        <div ref={notificationsRef} className="relative">
        <button onClick={() => setNotificationsOpen((open) => !open)} className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-full bg-[#201f1f] text-[#c1c8c2] hover:bg-[#2a2a2a] transition-colors relative" aria-label="Notificaciones" aria-expanded={notificationsOpen}>
          <Bell size={20} />
          {unreadNotifications.length > 0 && <span className="absolute top-2 right-2 min-w-5 h-5 px-1 bg-[#7ed957] text-[#0e0e0e] rounded-full text-[10px] font-black flex items-center justify-center">{unreadNotifications.length}</span>}
        </button>
        {notificationsOpen && <><button className="fixed inset-0 z-[45] cursor-default" aria-label="Cerrar notificaciones" onMouseDown={() => setNotificationsOpen(false)} /><div className="absolute right-0 top-[56px] z-[60] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[#2b3a2f] bg-[#151a16] p-3 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between gap-3 px-2 pb-3 border-b border-[#2b3a2f]"><span className="text-white text-sm font-semibold">Notificaciones</span><button onClick={markAllAsRead} disabled={unreadNotifications.length === 0} className="text-xs text-[#7ed957] hover:text-[#b7f397] disabled:text-[#59635c]">Marcar todas</button></div>
          {notifications.length === 0 ? <p className="text-[#8b938d] text-sm px-2 py-5 text-center">No hay notificaciones nuevas</p> : notifications.map((notification) => <div key={notification.id} className="flex gap-3 px-2 py-3 border-b border-[#2b3a2f] last:border-0"><div className="flex-1"><p className="text-[#b7f397] text-xs font-semibold">{notification.title}</p><p className="text-[#c1c8c2] text-sm mt-1">{notification.message}</p></div><button onClick={() => removeNotification(notification.id)} aria-label="Descartar notificación" className="text-[#8b938d] hover:text-white"><X size={15} /></button></div>)}
        </div></>}
        </div>

        <div className="relative">
          <button type="button" onClick={() => setUserMenuOpen((open) => !open)} className="flex items-center gap-3 rounded-full p-1 pr-3 hover:bg-[#201f1f] transition-colors" aria-expanded={userMenuOpen} aria-haspopup="menu">
            <div className="h-11 w-11 rounded-full bg-[#7ed957] text-[#0e0e0e] flex items-center justify-center font-bold text-sm">{iniciales}</div>
            <div className="hidden sm:block text-left">
              <p className="text-white text-sm font-semibold leading-tight">{nombreUsuario}</p>
              <p className="text-[#8b938d] text-xs capitalize mt-1">{funcionUsuario}</p>
            </div>
            <ChevronDown size={16} className={`hidden sm:block text-[#8b938d] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" aria-label="Cerrar menú de usuario" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-[56px] z-20 w-56 rounded-2xl border border-[#2b3a2f] bg-[#151a16] p-2 shadow-2xl shadow-black/40" role="menu">
                <div className="border-b border-[#2b3a2f] px-3 py-3 mb-1 sm:hidden">
                  <p className="text-white text-sm font-semibold">{nombreUsuario}</p>
                  <p className="text-[#8b938d] text-xs capitalize mt-1">{funcionUsuario}</p>
                </div>
                <button onClick={() => { setUserMenuOpen(false); router.push('/dashboard/administracion?tab=negocio'); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#c1c8c2] hover:bg-[#7ed957]/10 hover:text-[#b7f397] transition-colors" role="menuitem">
                  <Settings size={17} /> Configuración
                </button>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#e9a6a0] hover:bg-red-500/10 transition-colors" role="menuitem">
                  <LogOut size={17} /> Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
