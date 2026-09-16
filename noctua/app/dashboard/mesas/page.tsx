"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMesasStore } from "@/store/mesasStore";
import { useMozosStore } from "@/store/mozosStore";
import { usePedidosStore } from "@/store/pedidosStore";
import { setComensales } from "@/services/comensalesService";
import { MesasFloorPlan } from "@/components/mesas/MesasFloorPlan";
import { MesasPageHeader, type MesaFiltro } from "@/components/mesas/MesasPageHeader";
import { Button } from "@/components/ui/Button";
import type { Mesa } from "@/types/mesa";

const UBICACION_POR_DEFECTO = "SALÓN PRINCIPAL";
const REFRESH_PEDIDOS_MS = 20_000; // 20 segundos, igual que /dashboard/cocina

export default function MesasPage() {
  const router = useRouter();
  const iniciarPedido = usePedidosStore((s) => s.iniciarPedido);
  const mesas = useMesasStore((s) => s.mesas);
  const mesasSeleccionadas = useMesasStore((s) => s.mesasSeleccionadas);
  const toggleSeleccionMesa = useMesasStore((s) => s.toggleSeleccionMesa);
  const limpiarSeleccion = useMesasStore((s) => s.limpiarSeleccion);

  const fetchMozos = useMozosStore((s) => s.fetchMozos);
  const suscribirCambiosMozos = useMozosStore((s) => s.suscribirCambiosMozos);
  const desuscribirCambiosMozos = useMozosStore((s) => s.desuscribirCambiosMozos);

  const cargarPedidosActivos = usePedidosStore((s) => s.cargarPedidosActivos);
  const cargarMesas = useMesasStore((s) => s.cargarMesas);
  const suscribirCambiosMesas = useMesasStore((s) => s.suscribirCambiosMesas);
  const crearMesaDesdePanel = useMesasStore((s) => s.crearMesaDesdePanel);
  const eliminarMesaDesdePanel = useMesasStore((s) => s.eliminarMesaDesdePanel);
  const isLoading = useMesasStore((s) => s.isLoading);
  const error = useMesasStore((s) => s.error);

  const [mesaAEliminar, setMesaAEliminar] = useState<Mesa | null>(null);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<MesaFiltro>("todas");
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const floorWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cargarMesas();
    cargarPedidosActivos();
    fetchMozos();
    const unsubscribeMesas = suscribirCambiosMesas();
    suscribirCambiosMozos();
    // Los pedidos (items, total, mozo real) no tienen suscripción propia como
    // mesas/mozos: se refrescan por polling, igual que en /dashboard/cocina.
    const pedidosInterval = setInterval(cargarPedidosActivos, REFRESH_PEDIDOS_MS);
    return () => {
      unsubscribeMesas();
      desuscribirCambiosMozos();
      clearInterval(pedidosInterval);
    };
  }, [cargarMesas, cargarPedidosActivos, suscribirCambiosMesas, fetchMozos, suscribirCambiosMozos, desuscribirCambiosMozos]);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      floorWrapperRef.current?.requestFullscreen();
    }
  }, []);

  const visibleMesaIds = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (activeFilter === "todas" && !term) return null;
    const ids = new Set<string>();
    mesas.forEach((mesa) => {
      const matchesFilter = activeFilter === "todas" || mesa.estado === activeFilter;
      const matchesSearch = !term || String(mesa.numero).includes(term) || mesa.zona.toLowerCase().includes(term);
      if (matchesFilter && matchesSearch) ids.add(mesa.id);
    });
    return ids;
  }, [mesas, activeFilter, search]);

  const abrirAlertaEliminar = (id: string) => {
    const mesa = mesas.find((m) => m.id === id);

    if (!mesa) return;

    setMesaAEliminar(mesa);
  };

  const confirmarEliminarMesa = async () => {
    if (!mesaAEliminar) return;

    await eliminarMesaDesdePanel(mesaAEliminar.id);

    setMesaAEliminar(null);
  };

  const cancelarEliminarMesa = () => {
    setMesaAEliminar(null);
  };

  const crearMesaDesdeEditor = useCallback(async (numeroElegido?: number, capacidadElegida?: number, forma?: Mesa["forma"]) => {
    const siguienteNumero = numeroElegido || mesas.reduce((maximo, mesa) => Math.max(maximo, mesa.numero), 0) + 1;
    // La base exige capacidad > 0; una mesa recién creada en el editor todavía no tiene
    // sillas asignadas, así que se arranca con una capacidad razonable por defecto.
    await crearMesaDesdePanel({ numero: siguienteNumero, capacidad: capacidadElegida ?? 4, ubicacion: UBICACION_POR_DEFECTO, forma });
    await cargarMesas();
  }, [mesas, crearMesaDesdePanel, cargarMesas]);

  const handleSingleClick = useCallback(
    (id: string) => {
      toggleSeleccionMesa(id);
    },
    [toggleSeleccionMesa]
  );

  const handleDoubleClick = useCallback(
    (mesa: Mesa) => {
      limpiarSeleccion();
      const comensales = mesa.personas || mesa.capacidad;
      setComensales(mesa.id, comensales).catch(() => {});
      iniciarPedido(mesa.id, mesa.numero, mesa.zona, comensales);
      router.push(`/dashboard/pedido?mesa=${mesa.id}`);
    },
    [limpiarSeleccion, iniciarPedido, router]
  );

  return (
    <div className="flex h-[calc(100vh-112px)] min-h-0 flex-col overflow-hidden md:h-[calc(100vh-168px)]">
      <MesasPageHeader
        mesas={mesas}
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        editorMode={editorMode}
        onToggleEditorMode={() => setEditorMode((mode) => (mode === "edit" ? "preview" : "edit"))}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

      {isLoading && mesas.length === 0 && (
        <div className="text-[#BCB9B9]">
          Cargando mesas desde el backend...
        </div>
      )}

      {/* Plano de planta de mesas */}
      <div ref={floorWrapperRef} className="relative flex min-h-0 flex-1 flex-col bg-[#0b0f0c]">
        <MesasFloorPlan
          mesas={mesas}
          mesasSeleccionadas={mesasSeleccionadas}
          onSingleClick={handleSingleClick}
          onDoubleClick={handleDoubleClick}
          onDelete={abrirAlertaEliminar}
          onCreateMesa={crearMesaDesdeEditor}
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
          visibleMesaIds={visibleMesaIds}
        />
      </div>

      <AnimatePresence>
  {mesaAEliminar && (
    <motion.div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="w-full max-w-md bg-[#080808] border border-[#1f1f1f] rounded-2xl shadow-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <span className="text-red-400 text-2xl font-black">!</span>
          </div>

          <div className="flex-1">
            <h2 className="text-white text-lg font-black tracking-widest uppercase">
              Eliminar mesa
            </h2>

            <p className="text-[#BCB9B9] text-sm mt-2 leading-relaxed">
              ¿Seguro que querés eliminar la mesa{" "}
              <span className="text-white font-bold">
                N° {mesaAEliminar.numero}
              </span>
              ?
            </p>

            <p className="text-[#676B67] text-xs mt-2 leading-relaxed">
              Esta acción eliminará la mesa del sistema si no tiene pedidos o
              reservas asociadas.
            </p>
          </div>
        </div>

        <div className="mt-6 bg-black border border-[#1a1a1a] rounded-xl p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[#676B67] text-xs uppercase font-semibold">
                Ubicación
              </p>
              <p className="text-white font-semibold">
                {mesaAEliminar.zona}
              </p>
            </div>

            <div>
              <p className="text-[#676B67] text-xs uppercase font-semibold">
                Capacidad
              </p>
              <p className="text-white font-semibold">
                {mesaAEliminar.capacidad} personas
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={cancelarEliminarMesa}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            variant="danger"
            className="flex-1"
            onClick={confirmarEliminarMesa}
            loading={isLoading}
          >
            Eliminar
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
    </div>
  );
}
