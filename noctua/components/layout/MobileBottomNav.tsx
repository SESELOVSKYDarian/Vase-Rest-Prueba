'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Menu } from 'lucide-react';
import { cn } from '@/hooks/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavStore } from '@/store/mobileNavStore';
import { NAV_ITEMS } from '@/components/layout/Sidebar';
import { LABEL_POR_SECCION, RUTA_POR_SECCION, obtenerSeccionesPorRol, CATEGORIA_POR_SECCION } from '@/config/roles';

const MAX_PRIMARY_ITEMS = 3;

// Rutas donde el MobileBottomNav no se muestra porque la pantalla ya tiene su propio
// bottom sheet fijo peleando por el mismo borde inferior. Exportado para que
// DashboardContent sepa cuándo NO reservar el espacio de abajo tampoco.
export const OCULTA_MOBILE_BOTTOM_NAV = ['/dashboard/pedido'];

// Acceso rápido con el pulgar a las 3 pantallas de uso diario del rol (privilegiando
// "operación" — Mesas/Pedidos/Cocina/Caja — sobre gestión/sistema) + Inicio + Más
// (abre el mismo drawer completo del Sidebar). Complementa al hamburguesa+drawer que
// ya existe, no lo reemplaza: ese sigue siendo el único camino a TODAS las secciones.
export function MobileBottomNav() {
  const pathname = usePathname();
  const usuario = useAuthStore((state) => state.usuario);
  const toggleMobileNav = useMobileNavStore((state) => state.toggle);
  const mobileNavOpen = useMobileNavStore((state) => state.isOpen);

  // Pedido ya tiene su propio bottom sheet fijo en mobile (carrito/enviar a cocina,
  // que además se expande hasta 70vh) — mostrar los dos a la vez sería chrome
  // redundante peleando por el mismo borde inferior de la pantalla.
  if (OCULTA_MOBILE_BOTTOM_NAV.some((prefijo) => pathname.startsWith(prefijo))) return null;

  const secciones = obtenerSeccionesPorRol(usuario?.rol);
  const primarias = NAV_ITEMS
    .filter(({ seccion }) => secciones.includes(seccion))
    .sort((a, b) => {
      const pesoA = CATEGORIA_POR_SECCION[a.seccion] === 'operacion' ? 0 : 1;
      const pesoB = CATEGORIA_POR_SECCION[b.seccion] === 'operacion' ? 0 : 1;
      return pesoA - pesoB;
    })
    .slice(0, MAX_PRIMARY_ITEMS);

  const isInicioActive = pathname === '/dashboard';

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch bg-surface/95 backdrop-blur-xl border-t border-line"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="navigation"
      aria-label="Navegación rápida"
    >
      <Link
        href="/dashboard"
        aria-current={isInicioActive ? 'page' : undefined}
        className={cn('flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium', isInicioActive ? 'text-brand' : 'text-ink-3')}
      >
        <Home size={20} strokeWidth={isInicioActive ? 2.4 : 1.9} />
        Inicio
      </Link>

      {primarias.map(({ seccion, icon: Icon }) => {
        const href = RUTA_POR_SECCION[seccion];
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={seccion}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn('flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium truncate px-1', isActive ? 'text-brand' : 'text-ink-3')}
          >
            <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
            {LABEL_POR_SECCION[seccion]}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={toggleMobileNav}
        aria-expanded={mobileNavOpen}
        aria-label="Más secciones"
        className={cn('flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium', mobileNavOpen ? 'text-brand' : 'text-ink-3')}
      >
        <Menu size={20} strokeWidth={mobileNavOpen ? 2.4 : 1.9} />
        Más
      </button>
    </nav>
  );
}
