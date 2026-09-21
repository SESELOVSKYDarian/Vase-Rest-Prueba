'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, UtensilsCrossed, ClipboardList, ChefHat, Package, CalendarDays, BarChart3, History, Receipt, ShieldCheck, Truck, Headphones, Utensils, Contact } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useMesasStore } from '@/store/mesasStore';
import { usePedidosStore } from '@/store/pedidosStore';
import { useMozosStore } from '@/store/mozosStore';
import { TurnoMozosCard } from '@/components/dashboard/TurnoMozosCard';
import { LABEL_POR_SECCION, RUTA_POR_SECCION, obtenerSeccionesPorRol, type SeccionSistema } from '@/config/roles';

const ICONO_POR_SECCION: Partial<Record<SeccionSistema, typeof UtensilsCrossed>> = {
  analytics: BarChart3, mesas: UtensilsCrossed, pedidos: ClipboardList, cocina: ChefHat,
  cajero: Receipt, historial: History, stock: Package, platos: Utensils,
  delivery: Truck, reservas: CalendarDays, clientes: Contact, administracion: ShieldCheck, soporte: Headphones,
};

export default function InicioPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const rol = usuario?.rol;
  const secciones = obtenerSeccionesPorRol(rol);

  const mesas = useMesasStore((s) => s.mesas);
  const cargarMesas = useMesasStore((s) => s.cargarMesas);
  const pedidos = usePedidosStore((s) => s.pedidos);
  const cargarPedidosActivos = usePedidosStore((s) => s.cargarPedidosActivos);
  const fetchMozos = useMozosStore((s) => s.fetchMozos);

  useEffect(() => {
    cargarMesas();
    cargarPedidosActivos();
    fetchMozos();
  }, [cargarMesas, cargarPedidosActivos, fetchMozos]);

  const mesasOcupadas = useMemo(() => mesas.filter((m) => m.estado !== 'libre').length, [mesas]);
  const pedidosActivos = pedidos.length;
  const pedidosPorCobrar = useMemo(
    () => mesas.filter((m) => m.estado === 'para_cobrar' || m.estado === 'esperando_pago').length,
    [mesas]
  );
  const pedidosPorEstadoCocina = useMemo(() => {
    const conteo: Record<string, number> = { pendiente: 0, preparando: 0, listo: 0 };
    pedidos.forEach((p) => { if (p.estado in conteo) conteo[p.estado] += 1; });
    return conteo;
  }, [pedidos]);

  const nombre = usuario?.nombre?.split(' ')[0] ?? '';
  const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Hola{nombre ? `, ${nombre}` : ''}</h1>
        <p className="mt-1 text-sm capitalize text-[#7b9180]">{fecha}</p>
      </div>

      {(rol === 'admin' || rol === 'cocina') && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResumenTile label="Mesas ocupadas" value={mesasOcupadas} />
          <ResumenTile label="Pedidos activos" value={pedidosActivos} />
          <ResumenTile label="Por cobrar" value={pedidosPorCobrar} />
          <ResumenTile label="En cocina" value={pedidosPorEstadoCocina.pendiente + pedidosPorEstadoCocina.preparando} />
        </section>
      )}

      {rol === 'cajero' && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ResumenTile label="Por cobrar" value={pedidosPorCobrar} />
          <ResumenTile label="Mesas ocupadas" value={mesasOcupadas} />
          <ResumenTile label="Pedidos activos" value={pedidosActivos} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#647568]">Accesos directos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {secciones.map((seccion) => {
            const Icon = ICONO_POR_SECCION[seccion] ?? UtensilsCrossed;
            return (
              <Link
                key={seccion}
                href={RUTA_POR_SECCION[seccion]}
                className="group flex min-h-28 flex-col justify-between rounded-2xl border border-[#1d2b21] bg-[#0e0e0e] p-5 transition-colors hover:border-[#7ed957]/40 hover:bg-[#121712]"
              >
                <Icon size={22} className="text-[#7ed957]" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{LABEL_POR_SECCION[seccion]}</span>
                  <ArrowRight size={16} className="text-[#526057] transition-transform group-hover:translate-x-0.5 group-hover:text-[#7ed957]" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {rol === 'admin' && (
        <Link
          href="/dashboard/analytics"
          className="flex items-center justify-between rounded-2xl border border-[#1d2b21] bg-[#0e0e0e] p-5 text-sm text-[#b7f397] transition-colors hover:border-[#7ed957]/40"
        >
          Ver analítica completa
          <ArrowRight size={16} />
        </Link>
      )}

      {(rol === 'admin' || rol === 'mozo') && <TurnoMozosCard />}
    </div>
  );
}

function ResumenTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#1d2b21] bg-[#0e0e0e] p-5">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-[#7b9180]">{label}</p>
    </div>
  );
}
