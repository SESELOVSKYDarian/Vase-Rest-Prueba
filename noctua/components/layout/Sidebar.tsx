'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed, ClipboardList, ChefHat, Package, CalendarDays, LayoutDashboard, Menu, X, History, Receipt, ShieldCheck, Truck, Headphones, Utensils, Home, Users, Palette, Contact } from 'lucide-react';
import { cn } from '@/hooks/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavStore } from '@/store/mobileNavStore';
import { LABEL_POR_SECCION, RUTA_POR_SECCION, obtenerSeccionesPorRol, CATEGORIA_POR_SECCION, LABEL_POR_CATEGORIA, ORDEN_CATEGORIAS, type SeccionSistema } from '@/config/roles';

export const NAV_ITEMS = [
  { seccion: 'analytics', icon: LayoutDashboard }, { seccion: 'mesas', icon: UtensilsCrossed },
  { seccion: 'pedidos', icon: ClipboardList }, { seccion: 'cocina', icon: ChefHat },
  { seccion: 'cajero', icon: Receipt }, { seccion: 'historial', icon: History },
  { seccion: 'stock', icon: Package }, { seccion: 'platos', icon: Utensils },
  { seccion: 'delivery', icon: Truck },
  { seccion: 'reservas', icon: CalendarDays }, { seccion: 'clientes', icon: Contact },
  { seccion: 'administracion', icon: ShieldCheck },
  { seccion: 'soporte', icon: Headphones }, { seccion: 'mozos', icon: Users },
  { seccion: 'diseno', icon: Palette },
] satisfies { seccion: SeccionSistema; icon: typeof UtensilsCrossed }[];

// Indicador activo: resorte críticamente amortiguado (sin rebote) — se mueve decenas de
// veces por día, así que rápido y sobrio.
const ACTIVE_SPRING = { type: 'spring', duration: 0.32, bounce: 0 } as const;

// Tres anchos: xl muestra etiquetas siempre (reconocer > recordar); lg es un riel de
// íconos con tooltip; en mobile/tablet es un drawer completo (+ MobileBottomNav).
export function Sidebar() {
  const pathname = usePathname();
  const usuario = useAuthStore((state) => state.usuario);
  const mobileOpen = useMobileNavStore((state) => state.isOpen);
  const toggleMobileNav = useMobileNavStore((state) => state.toggle);
  const closeMobileNav = useMobileNavStore((state) => state.close);
  const seccionesPermitidas = obtenerSeccionesPorRol(usuario?.rol);
  const itemsVisibles = NAV_ITEMS.filter(({ seccion }) => seccionesPermitidas.includes(seccion));
  const grupos = ORDEN_CATEGORIAS.map((categoria) => ({
    categoria,
    items: itemsVisibles.filter(({ seccion }) => CATEGORIA_POR_SECCION[seccion] === categoria),
  })).filter((grupo) => grupo.items.length > 0);

  return <>
    <button
      className="pressable lg:hidden fixed top-3.5 left-4 z-[60] h-11 w-11 grid place-items-center rounded-xl bg-surface border border-line text-ink shadow-soft"
      onClick={toggleMobileNav}
      aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={mobileOpen}
    >
      {mobileOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
    <AnimatePresence>
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="lg:hidden fixed inset-0 bg-scrim z-40"
          onClick={closeMobileNav}
        />
      )}
    </AnimatePresence>

    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-full w-[264px] flex-col border-r border-line bg-surface transition-transform duration-300 ease-[var(--ease-drawer)]',
        'lg:w-[76px] xl:w-[248px] lg:bg-surface/80 lg:backdrop-blur-xl',
        mobileOpen ? 'translate-x-0 shadow-float' : '-translate-x-full lg:translate-x-0',
      )}
    >
      <Link href="/dashboard" onClick={closeMobileNav} className="flex h-[72px] shrink-0 items-center gap-3 px-5 lg:justify-center lg:px-0 xl:justify-start xl:px-6">
        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-line bg-white">
          <Image src="/vaserestlogo.png" alt="Vase Rest" width={36} height={36} className="h-full w-full object-cover" priority />
        </span>
        <span className="font-display text-[1.6rem] leading-none text-ink lg:hidden xl:inline">Vase Rest</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 pt-2 lg:px-2.5 xl:px-3" aria-label="Navegación principal">
        <NavLink href="/dashboard" label="Inicio" Icon={Home} active={pathname === '/dashboard'} onNavigate={closeMobileNav} />
        {grupos.map(({ categoria, items }) => (
          <div key={categoria} role="group" aria-label={LABEL_POR_CATEGORIA[categoria]} className="mt-5">
            <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3 lg:hidden xl:block">{LABEL_POR_CATEGORIA[categoria]}</p>
            <span className="mx-auto mb-2 hidden h-px w-6 bg-line lg:block xl:hidden" aria-hidden="true" />
            <div className="space-y-0.5">
              {items.map(({ seccion, icon }) => {
                const href = RUTA_POR_SECCION[seccion];
                return <NavLink key={href} href={href} label={LABEL_POR_SECCION[seccion]} Icon={icon} active={pathname.startsWith(href)} onNavigate={closeMobileNav} />;
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  </>;
}

function NavLink({ href, label, Icon, active, onNavigate }: { href: string; label: string; Icon: typeof Home; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      title={label}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors duration-150',
        'lg:justify-center lg:px-0 xl:justify-start xl:px-3',
        active ? 'text-ink font-medium' : 'text-ink-2 hover:text-ink hover:bg-ink/[0.04]',
      )}
    >
      {active && (
        <motion.span layoutId="sidebar-active" transition={ACTIVE_SPRING} className="absolute inset-0 rounded-xl bg-brand-soft" aria-hidden="true" />
      )}
      <Icon size={19} strokeWidth={active ? 2.1 : 1.8} className={cn('relative shrink-0 transition-colors', active ? 'text-brand-strong' : 'text-ink-3 group-hover:text-ink-2')} />
      <span className="relative truncate lg:hidden xl:inline">{label}</span>
    </Link>
  );
}
