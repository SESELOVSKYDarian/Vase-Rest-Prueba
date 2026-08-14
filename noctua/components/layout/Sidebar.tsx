'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed, ClipboardList, ChefHat, Package, CalendarDays, LayoutDashboard, Menu, X, History, Receipt, ShieldCheck, Truck, Headphones, Utensils, Tag } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/hooks/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { LABEL_POR_SECCION, RUTA_POR_SECCION, obtenerSeccionesPorRol, type SeccionSistema } from '@/config/roles';

const NAV_ITEMS = [
  { seccion: 'analytics', icon: LayoutDashboard }, { seccion: 'mesas', icon: UtensilsCrossed },
  { seccion: 'pedidos', icon: ClipboardList }, { seccion: 'cocina', icon: ChefHat },
  { seccion: 'cajero', icon: Receipt }, { seccion: 'historial', icon: History },
  { seccion: 'stock', icon: Package }, { seccion: 'platos', icon: Utensils },
  { seccion: 'promociones', icon: Tag }, { seccion: 'delivery', icon: Truck },
  { seccion: 'reservas', icon: CalendarDays }, { seccion: 'administracion', icon: ShieldCheck },
  { seccion: 'soporte', icon: Headphones },
] satisfies { seccion: SeccionSistema; icon: typeof UtensilsCrossed }[];

export function Sidebar() {
  const pathname = usePathname();
  const usuario = useAuthStore((state) => state.usuario);
  const [mobileOpen, setMobileOpen] = useState(false);
  const seccionesPermitidas = obtenerSeccionesPorRol(usuario?.rol);

  return <>
    <button className="lg:hidden fixed top-5 left-4 z-[60] h-11 w-11 flex items-center justify-center bg-[#151a16] border border-[#2b3a2f] rounded-xl text-white shadow-lg shadow-black/30" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Abrir menú">{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
    <AnimatePresence>{mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileOpen(false)} />}</AnimatePresence>
    <aside className={cn('fixed left-0 top-0 h-full w-20 hover:w-72 bg-[#0e0e0e]/90 backdrop-blur-xl border-r border-[#1d2b21] flex flex-col z-50 transition-all duration-300 overflow-hidden group', mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
      <div className="px-6 py-8 flex items-center gap-4 min-w-[280px]">
        <div className="h-9 w-9 overflow-hidden rounded-xl bg-white flex-shrink-0 shadow-[0_0_18px_rgba(126,217,87,0.16)]">
          <Image src="/vaserestlogo.png" alt="Vase Rest" width={36} height={36} className="h-full w-full object-cover" priority />
        </div>
        <h1 className="font-display text-2xl font-black tracking-tight text-white leading-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Vase <span className="text-[#7ed957]">Rest</span></h1>
      </div>
      <nav className="flex-1 px-3 py-8 space-y-3 overflow-y-auto" role="navigation" aria-label="Navegación principal">
        {NAV_ITEMS.filter(({ seccion }) => seccionesPermitidas.includes(seccion)).map(({ seccion, icon: Icon }) => {
          const href = RUTA_POR_SECCION[seccion]; const isActive = pathname.startsWith(href);
          return <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={isActive ? 'page' : undefined} className={cn('flex items-center justify-start gap-4 px-4 py-4 rounded-[22px] text-sm font-medium transition-all duration-300 min-w-[240px]', isActive ? 'bg-[#7ed957]/12 text-[#b7f397] shadow-[inset_0_0_0_1px_rgba(126,217,87,0.18)]' : 'text-[#829487] hover:text-white hover:bg-[#7ed957]/7')}>
            <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} className={cn('flex-shrink-0 transition-colors', isActive ? 'text-[#7ed957]' : 'text-[#708375] group-hover:text-[#b7f397]')} />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-1 tracking-wide">{LABEL_POR_SECCION[seccion]}</span>
            {isActive && <motion.div layoutId="sidebar-active" className="ml-auto w-1.5 h-1.5 bg-[#7ed957] rounded-full" />}
          </Link>;
        })}
      </nav>
    </aside>
  </>;
}
