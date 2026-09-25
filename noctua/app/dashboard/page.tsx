'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useMesasStore } from '@/store/mesasStore';
import { usePedidosStore } from '@/store/pedidosStore';
import { useMozosStore } from '@/store/mozosStore';
import { TurnoMozosCard } from '@/components/dashboard/TurnoMozosCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { NAV_ITEMS } from '@/components/layout/Sidebar';
import { MESA_ESTADO_HEX } from '@/components/mesas/mesaEstadoColors';
import { TEXTO_ESTADO_MESA } from '@/hooks/lib/constants';
import {
  CATEGORIA_POR_SECCION,
  DESCRIPCION_POR_SECCION,
  LABEL_POR_CATEGORIA,
  LABEL_POR_SECCION,
  ORDEN_CATEGORIAS,
  RUTA_POR_SECCION,
  obtenerSeccionesPorRol,
  type SeccionSistema,
} from '@/config/roles';
import type { EstadoMesa } from '@/types/mesa';

const ORDEN_ESTADOS: EstadoMesa[] = ['ocupada', 'esperando_pedido', 'pedido_listo', 'para_cobrar', 'esperando_pago', 'problema', 'libre'];

function saludo(hora: number) {
  if (hora < 6) return 'Buenas noches';
  if (hora < 13) return 'Buen día';
  if (hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

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

  const conteoEstados = useMemo(() => {
    const conteo = Object.fromEntries(ORDEN_ESTADOS.map((e) => [e, 0])) as Record<EstadoMesa, number>;
    mesas.forEach((m) => { conteo[m.estado] = (conteo[m.estado] ?? 0) + 1; });
    return conteo;
  }, [mesas]);

  const mesasOcupadas = mesas.length - conteoEstados.libre;
  const porCobrar = conteoEstados.para_cobrar + conteoEstados.esperando_pago;
  const enCocina = useMemo(() => pedidos.filter((p) => p.estado === 'pendiente' || p.estado === 'preparando').length, [pedidos]);
  const listos = useMemo(() => pedidos.filter((p) => p.estado === 'listo').length, [pedidos]);

  const nombre = usuario?.nombre?.split(' ')[0] ?? '';
  const ahora = new Date();
  const fecha = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const veSalon = secciones.includes('mesas') || secciones.includes('pedidos');
  const veCocina = secciones.includes('cocina');

  const itemsPorSeccion = new Map(NAV_ITEMS.map((item) => [item.seccion, item.icon]));
  const operacion = secciones.filter((s) => CATEGORIA_POR_SECCION[s] === 'operacion');
  const resto = ORDEN_CATEGORIAS.filter((c) => c !== 'operacion')
    .map((categoria) => ({ categoria, items: secciones.filter((s) => CATEGORIA_POR_SECCION[s] === categoria) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="stagger space-y-10 pb-4">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-3 first-letter:uppercase">{fecha}</p>
        <h1>
          {saludo(ahora.getHours())}
          {nombre && <span className="text-ink-3">, {nombre}</span>}
        </h1>
      </header>

      {veSalon && (
        <section className="card p-6 sm:p-8" aria-labelledby="pulso-salon">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="pulso-salon" className="text-sm font-medium text-ink-3">El salón ahora</h2>
              <p className="mt-1 text-ink text-lg">
                <AnimatedNumber value={mesasOcupadas} className="font-display text-5xl leading-none" />
                <span className="ml-2 text-ink-3">de {mesas.length} mesas con gente</span>
              </p>
            </div>
            <Link href="/dashboard/mesas" className="pressable group inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm text-ink-2 hover:text-ink hover:border-line-strong">
              Ver el plano
              <ArrowUpRight size={15} className="transition-transform duration-200 [@media(hover:hover)]:group-hover:-translate-y-0.5 [@media(hover:hover)]:group-hover:translate-x-0.5" />
            </Link>
          </div>

          <OcupacionBar conteo={conteoEstados} total={mesas.length} />

          <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 border-t border-line">
            <Metrica label="Pedidos activos" value={pedidos.length} href="/dashboard/cocina" />
            <Metrica label="En cocina" value={enCocina} href="/dashboard/cocina" />
            <Metrica label="Listos para servir" value={listos} href="/dashboard/cocina" tono={listos > 0 ? 'atencion' : undefined} />
            <Metrica label="Por cobrar" value={porCobrar} href="/dashboard/facturas" tono={porCobrar > 0 ? 'atencion' : undefined} />
          </dl>
        </section>
      )}

      {!veSalon && veCocina && (
        <section className="card p-6 sm:p-8">
          <h2 className="text-base text-ink font-medium text-ink-3">La cocina ahora</h2>
          <dl className="mt-4 grid grid-cols-3 border-t border-line">
            <Metrica label="Pendientes" value={pedidos.filter((p) => p.estado === 'pendiente').length} href="/dashboard/cocina" />
            <Metrica label="Preparando" value={pedidos.filter((p) => p.estado === 'preparando').length} href="/dashboard/cocina" />
            <Metrica label="Listos" value={listos} href="/dashboard/cocina" tono={listos > 0 ? 'atencion' : undefined} />
          </dl>
        </section>
      )}

      {operacion.length > 0 && (
        <section aria-labelledby="ir-a">
          <h2 id="ir-a" className="mb-4 text-sm font-medium text-ink-3">Ir a</h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {operacion.map((seccion) => (
              <AccesoPrincipal key={seccion} seccion={seccion} Icon={itemsPorSeccion.get(seccion)} />
            ))}
          </div>
        </section>
      )}

      {resto.length > 0 && (
        <section className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
          {resto.map(({ categoria, items }) => (
            <div key={categoria}>
              <h2 className="mb-2 text-sm font-medium text-ink-3">{LABEL_POR_CATEGORIA[categoria]}</h2>
              <ul className="divide-y divide-line border-y border-line">
                {items.map((seccion) => {
                  const Icon = itemsPorSeccion.get(seccion);
                  return (
                    <li key={seccion}>
                      <Link href={RUTA_POR_SECCION[seccion]} className="group flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg transition-colors hover:bg-surface">
                        {Icon && <Icon size={18} strokeWidth={1.8} className="text-ink-3 transition-colors group-hover:text-brand" />}
                        <span className="flex-1 min-w-0">
                          <span className="block text-ink">{LABEL_POR_SECCION[seccion]}</span>
                          <span className="block text-xs text-ink-3 truncate">{DESCRIPCION_POR_SECCION[seccion]}</span>
                        </span>
                        <ChevronRight size={16} className="text-ink-3 transition-transform duration-200 [@media(hover:hover)]:group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {(rol === 'admin' || rol === 'mozo' || rol === 'encargado') && <TurnoMozosCard />}
    </div>
  );
}

function OcupacionBar({ conteo, total }: { conteo: Record<EstadoMesa, number>; total: number }) {
  const segmentos = ORDEN_ESTADOS.filter((e) => conteo[e] > 0);
  if (total === 0) return null;
  return (
    <div className="mt-6">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Mesas por estado">
        {segmentos.map((estado, i) => (
          <span
            key={estado}
            className="h-full origin-left animate-[grow-x_700ms_var(--ease-out)_both] first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(conteo[estado] / total) * 100}%`,
              background: estado === 'libre' ? 'var(--line-strong)' : MESA_ESTADO_HEX[estado],
              animationDelay: `${120 + i * 70}ms`,
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {segmentos.map((estado) => (
          <li key={estado} className="flex items-center gap-2 text-ink-2">
            <span className="h-2 w-2 rounded-full" style={{ background: estado === 'libre' ? 'var(--line-strong)' : MESA_ESTADO_HEX[estado] }} />
            {TEXTO_ESTADO_MESA[estado]}
            <span className="tabular text-ink-3">{conteo[estado]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metrica({ label, value, href, tono }: { label: string; value: number; href: string; tono?: 'atencion' }) {
  return (
    <Link href={href} className="group pt-5 pr-4 sm:pl-6 sm:first:pl-0 sm:border-l sm:first:border-l-0 border-line rounded-sm">
      <dt className="text-sm text-ink-3 transition-colors group-hover:text-ink-2">{label}</dt>
      <dd className={`mt-1 text-3xl font-medium ${tono === 'atencion' ? 'text-brand-strong' : 'text-ink'}`}>
        <AnimatedNumber value={value} />
      </dd>
    </Link>
  );
}

function AccesoPrincipal({ seccion, Icon }: { seccion: SeccionSistema; Icon?: (typeof NAV_ITEMS)[number]['icon'] }) {
  return (
    <Link
      href={RUTA_POR_SECCION[seccion]}
      className="pressable group card flex items-start gap-4 p-5 hover:border-line-strong hover:shadow-card"
    >
      {Icon && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong transition-transform duration-300 [@media(hover:hover)]:group-hover:-rotate-6">
          <Icon size={19} strokeWidth={1.9} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-medium text-ink">{LABEL_POR_SECCION[seccion]}</span>
        <span className="mt-0.5 block text-sm text-ink-3">{DESCRIPCION_POR_SECCION[seccion]}</span>
      </span>
    </Link>
  );
}
