import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BellRing, Flame, LayoutGrid, PencilRuler, Users } from 'lucide-react-native';
import { useWindowDimensions } from 'react-native';
import { alertaMesa, contarPorEstado, ESTADOS_MESA, ETIQUETA_ESTADO_MESA, ESTADOS_CON_PERSONAS, formatearARS, iniciales, intensidadesCalor, planoDesdeMesas, valorCalor, type EstadoMesa, type MetricaCalor, type Mesa } from '@vase/domain';
import { Button, Chip, EmptyState, ErrorBanner, Group, Row, Screen, Segmented, Skeleton, StatusPill, Text, Toast, haptic, space, useEstadoColor, useTheme } from '@vase/ui';
import { AvisosSheet } from '@/components/AvisosSheet';
import { MesaSheet } from '@/components/MesaSheet';
import { RepartoSheet } from '@/components/RepartoSheet';
import { PlanoCanvas, type Seleccion } from '@/components/plano/PlanoCanvas';
import { useAvisos, useCalor, useEstadoSalon, useMesas, usePedidosActivos, usePlano } from '@/lib/queries';
import { useSession } from '@/lib/session';

type Vista = 'plano' | 'lista';
type Filtro = EstadoMesa | 'todas' | 'demoradas';

const METRICAS: Array<{ id: MetricaCalor; titulo: string }> = [{ id: 'ventas', titulo: 'Ventas' }, { id: 'rotacion', titulo: 'Rotación' }, { id: 'permanencia', titulo: 'Permanencia' }];

/** "12'", "1 h 05'", "3 d": entra dentro de la mesa. */
function duracionCorta(min: number) {
  if (min < 60) return `${min}'`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}'`;
  return `${Math.floor(min / 1440)} d`;
}

export default function Salon() {
  const router = useRouter();
  const { colors, sizeClass } = useTheme();
  const colorDe = useEstadoColor();
  const mesasQ = useMesas();
  const pedidosQ = usePedidosActivos();
  const planoQ = usePlano();
  const rol = useSession((st) => st.usuario?.rol);
  const puedeEditar = rol === 'admin' || rol === 'encargado';
  const atiendeSalon = puedeEditar || rol === 'cajero' || rol === 'mozo';
  const avisosQ = useAvisos(atiendeSalon);
  const cantidadAvisos = (avisosQ.data?.solicitudes.length ?? 0) + (avisosQ.data?.pagos.length ?? 0) + (avisosQ.data?.facturas.length ?? 0);
  const [verAvisos, setVerAvisos] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const anteriores = useRef(0);
  // Un aviso nuevo vibra y se anuncia: el mozo no tiene que estar mirando la pantalla.
  useEffect(() => {
    if (cantidadAvisos > anteriores.current) { haptic.exito(); setMensaje(`${cantidadAvisos - anteriores.current === 1 ? 'Hay un aviso nuevo' : 'Hay avisos nuevos'} de las mesas`); }
    anteriores.current = cantidadAvisos;
  }, [cantidadAvisos]);
  const { height } = useWindowDimensions();
  const [vista, setVista] = useState<Vista>('plano');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [metrica, setMetrica] = useState<MetricaCalor | null>(null);
  const [repartoMesa, setRepartoMesa] = useState<Mesa | null>(null);
  const [verReparto, setVerReparto] = useState(false);
  const puedeVerCalor = puedeEditar || rol === 'cajero';
  const estadoQ = useEstadoSalon(atiendeSalon);
  const calorQ = useCalor(puedeVerCalor && metrica !== null);
  const [zona, setZona] = useState<string>('todas');
  const [elegida, setElegida] = useState<Mesa | null>(null);

  const mesas = useMemo(() => mesasQ.data ?? [], [mesasQ.data]);
  const zonas = useMemo(() => [...new Set(mesas.map((m) => m.zona))], [mesas]);
  const delaZona = useMemo(() => (zona === 'todas' ? mesas : mesas.filter((m) => m.zona === zona)), [mesas, zona]);
  const conteo = useMemo(() => contarPorEstado(delaZona), [delaZona]);
  const señales = useMemo(() => new Map((estadoQ.data?.mesas ?? []).map((x) => [x.mesaId, x])), [estadoQ.data]);
  const alertas = useMemo(() => {
    const r = new Map<string, ReturnType<typeof alertaMesa>>();
    for (const m of mesas) {
      const x = señales.get(m.id);
      const a = alertaMesa({ estadoMesa: m.estado, estadoPedido: x?.pedidoEstado, minEnEstado: x?.minEnEstado, minOcupada: x?.minOcupada });
      if (a.nivel !== 'ok') r.set(m.id, a);
    }
    return r;
  }, [mesas, señales]);
  const coincide = (m: Mesa) => (filtro === 'todas' ? true : filtro === 'demoradas' ? alertas.has(m.id) : m.estado === filtro);
  const visibles = useMemo(() => (filtro === 'todas' ? null : new Set(delaZona.filter(coincide).map((m) => m.id))), [delaZona, filtro, alertas]); // eslint-disable-line react-hooks/exhaustive-deps
  const demoradas = alertas.size;
  const mozos = estadoQ.data?.mozos ?? [];
  const intensidades = useMemo(() => (metrica && calorQ.data ? intensidadesCalor(calorQ.data.mesas, metrica) : null), [metrica, calorQ.data]);
  const calorPorMesa = useMemo(() => new Map((calorQ.data?.mesas ?? []).map((c) => [c.mesaId, c])), [calorQ.data]);
  const etiquetaCalor = (id: string) => {
    const c = calorPorMesa.get(id);
    const v = c && metrica ? valorCalor(c, metrica) : null;
    if (v == null || !metrica) return null;
    return metrica === 'ventas' ? (v >= 1000 ? `$ ${Math.round(v / 1000)} k` : formatearARS(c!.ventasCentavos)) : metrica === 'rotacion' ? `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })}/día` : `${v} min`;
  };
  const pedidoDe = (mesa: Mesa | null) => (mesa ? pedidosQ.data?.find((p) => p.mesaId === mesa.id) ?? null : null);

  const plano = useMemo(() => planoQ.data ?? planoDesdeMesas(mesas), [planoQ.data, mesas]);
  const porId = useMemo(() => new Map(mesas.map((m) => [m.id, m])), [mesas]);
  const pedidoPorMesa = useMemo(() => new Map((pedidosQ.data ?? []).map((p) => [p.mesaId, p])), [pedidosQ.data]);
  const infoMesa = (id: string) => {
    const m = porId.get(id);
    if (!m) return null;
    const p = pedidoPorMesa.get(id);
    const minutos = p ? Math.max(0, Math.floor((Date.now() - p.abiertoEn.getTime()) / 60000)) : null;
    return { numero: m.numero, estado: m.estado, detalle: minutos != null && ESTADOS_CON_PERSONAS.has(m.estado) ? duracionCorta(minutos) : undefined };
  };
  const visiblesPlano = useMemo(() => {
    if (filtro === 'todas' && zona === 'todas') return null;
    return new Set(mesas.filter((m) => coincide(m) && (zona === 'todas' || m.zona === zona)).map((m) => m.id));
  }, [mesas, filtro, zona, alertas]); // eslint-disable-line react-hooks/exhaustive-deps
  const seleccionar = (sel: Seleccion) => { if (sel?.tipo === 'mesa') { const m = porId.get(sel.id); if (m) setElegida(m); } };
  // El marco toma la proporción del local (sin franjas vacías), con un tope según la pantalla.
  const [anchoMarco, setAnchoMarco] = useState(0);
  const topeAlto = Math.max(320, Math.min(760, height * (sizeClass === 'compact' ? 0.58 : 0.66)));
  const altoPlano = anchoMarco ? Math.max(260, Math.min(topeAlto, anchoMarco * (plano.alto / plano.ancho) + 40)) : topeAlto;

  const ocupadas = mesas.filter((m) => ESTADOS_CON_PERSONAS.has(m.estado)).length;
  const subtitulo = mesas.length ? `${ocupadas} de ${mesas.length} mesas con gente` : undefined;
  const presentes = ESTADOS_MESA.filter((estado) => conteo[estado] > 0);

  const tomarPedido = (mesa: Mesa) => { setElegida(null); router.navigate({ pathname: '/pedido', params: { mesaId: mesa.id } }); };
  const cobrar = (mesa: Mesa) => { setElegida(null); router.navigate({ pathname: '/cobro', params: { mesaId: mesa.id } }); };

  return (
    <Screen
      title="Salón"
      subtitle={subtitulo}
      refreshing={mesasQ.isRefetching}
      onRefresh={() => { void mesasQ.refetch(); void pedidosQ.refetch(); }}
      bottomInset={sizeClass === 'compact' ? 72 : 0}
      headerRight={
        atiendeSalon ? (
          <View style={styles.acciones}>
            {mozos.length > 0 ? <Button label="Reparto" size="sm" variant="tinted" icon={<Users size={16} color={colors.tint} />} onPress={() => setVerReparto(true)} /> : null}
            <Button label={cantidadAvisos ? `Avisos · ${cantidadAvisos}` : 'Avisos'} size="sm" variant={cantidadAvisos ? 'filled' : 'tinted'} icon={<BellRing size={16} color={cantidadAvisos ? colors.onTint : colors.tint} />} onPress={() => setVerAvisos(true)} />
            {puedeEditar ? <Button label="Editar plano" size="sm" variant="tinted" icon={<PencilRuler size={16} color={colors.tint} />} onPress={() => router.push('/editor-plano')} /> : null}
          </View>
        ) : undefined
      }
    >
      {mesasQ.isPending ? (
        <View style={styles.stack}>
          <Skeleton height={40} />
          <Skeleton height={280} rounded={18} />
        </View>
      ) : mesasQ.isError ? (
        <ErrorBanner message={mesasQ.error instanceof Error ? mesasQ.error.message : 'No se pudieron cargar las mesas'} action={<Button label="Reintentar" size="sm" variant="tinted" onPress={() => void mesasQ.refetch()} />} />
      ) : mesas.length === 0 ? (
        <EmptyState icon={<LayoutGrid size={30} color={colors.labelSecondary} />} title="Todavía no hay mesas" message="Cuando se carguen las mesas del local, el plano aparece acá." />
      ) : (
        <View style={styles.stack}>
          <View style={styles.controles}>
            <View style={styles.segmento}>
              <Segmented<Vista> items={[{ value: 'plano', label: 'Plano' }, { value: 'lista', label: 'Lista' }]} value={vista} onChange={setVista} accessibilityLabel="Vista del salón" />
            </View>
            {zonas.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="Todas las zonas" selected={zona === 'todas'} onPress={() => setZona('todas')} />
                {zonas.map((z) => <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(z)} />)}
              </ScrollView>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Todas" count={delaZona.length} selected={filtro === 'todas'} onPress={() => setFiltro('todas')} />
              {demoradas > 0 ? <Chip label="Demoradas" count={demoradas} selected={filtro === 'demoradas'} onPress={() => setFiltro('demoradas')} /> : null}
              {presentes.map((estado) => (
                <Chip key={estado} label={ETIQUETA_ESTADO_MESA[estado]} count={conteo[estado]} selected={filtro === estado} onPress={() => setFiltro(estado)} />
              ))}
            </ScrollView>
          </View>

          {vista === 'plano' ? (
            <View style={styles.stack}>
              <View onLayout={(e) => setAnchoMarco(e.nativeEvent.layout.width)} style={[styles.marcoPlano, { height: altoPlano, backgroundColor: colors.surface }]}>
                <PlanoCanvas
                  plano={plano}
                  info={infoMesa}
                  modo="servicio"
                  seleccion={elegida ? { tipo: 'mesa', id: elegida.id } : null}
                  onSeleccionar={seleccionar}
                  visibles={visiblesPlano}
                  alerta={(id) => { const n = alertas.get(id)?.nivel; return n === 'urgente' || n === 'atencion' ? n : null; }}
                  calor={metrica && intensidades ? (id) => { const i = intensidades.get(id); const e = etiquetaCalor(id); return i != null && e ? { intensidad: i, etiqueta: e } : null; } : null}
                  colorCalor={colors.warning}
                  insignia={(id) => { const n = mozos.length > 1 ? señales.get(id)?.mozoNombre : null; return n ? iniciales(n) : null; }}
                />
              </View>
              {puedeVerCalor ? (
                <View style={styles.calor}>
                  <View style={styles.calorTitulo}><Flame size={16} color={colors.labelSecondary} /><Text variant="footnote" color="secondary">Mapa de calor · últimos {calorQ.data?.dias ?? 30} días</Text></View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    <Chip label="Apagado" selected={metrica === null} onPress={() => setMetrica(null)} />
                    {METRICAS.map((x) => <Chip key={x.id} label={x.titulo} selected={metrica === x.id} onPress={() => setMetrica(x.id)} />)}
                  </ScrollView>
                  {metrica && calorQ.isSuccess && calorQ.data.mesas.length === 0 ? <Text variant="footnote" color="secondary">Todavía no hay cuentas cerradas en este período: el mapa se va llenando con cada mesa que se cobra.</Text> : null}
                  {metrica && calorQ.isError ? <Text variant="footnote" color="danger">No se pudo calcular el mapa de calor.</Text> : null}
                </View>
              ) : null}
              {!planoQ.data && puedeEditar ? (
                <Text variant="footnote" color="secondary">Este plano se armó con la ubicación actual de las mesas. Tocá “Editar plano” para dibujar tu local: zonas, barra, paredes y la foto del plano.</Text>
              ) : null}
              <View style={styles.leyenda} accessibilityRole="list">
                {presentes.map((estado) => (
                  <View key={estado} style={styles.item}>
                    <View style={[styles.punto, { backgroundColor: colorDe(estado) }]} />
                    <Text variant="footnote" color="secondary">{ETIQUETA_ESTADO_MESA[estado]}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Group>
              {delaZona
                .filter((m) => (visibles ? visibles.has(m.id) : true))
                .map((mesa) => (
                  <Row key={mesa.id} title={`Mesa ${mesa.numero}`} subtitle={`${mesa.zona} · ${mesa.capacidad} lugares`} trailing={<StatusPill estado={mesa.estado} compact />} chevron onPress={() => setElegida(mesa)} />
                ))}
            </Group>
          )}
        </View>
      )}

      <MesaSheet
        mesa={elegida}
        pedido={pedidoDe(elegida)}
        onClose={() => setElegida(null)}
        onTomarPedido={tomarPedido}
        onCobrar={cobrar}
        alerta={elegida ? alertas.get(elegida.id) ?? null : null}
        mozoNombre={elegida ? señales.get(elegida.id)?.mozoNombre ?? null : null}
        onElegirMozo={atiendeSalon && mozos.length > 0 ? (m) => { setElegida(null); setRepartoMesa(m); } : undefined}
      />
      <RepartoSheet open={verReparto || !!repartoMesa} onClose={() => { setVerReparto(false); setRepartoMesa(null); }} mozos={mozos} mesa={repartoMesa} asignadoId={repartoMesa ? señales.get(repartoMesa.id)?.mozoId ?? null : null} onAviso={setMensaje} />
      <AvisosSheet open={verAvisos} onClose={() => setVerAvisos(false)} avisos={avisosQ.data} onAviso={setMensaje} />
      <Toast message={mensaje} onHide={() => setMensaje(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  acciones: { flexDirection: 'row', gap: space.sm },
  calor: { gap: space.sm },
  calorTitulo: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  stack: { gap: space.xl },
  controles: { gap: space.md },
  segmento: { maxWidth: 280 },
  chips: { gap: space.sm, paddingRight: space.xl },
  marcoPlano: { borderRadius: 18, overflow: 'hidden', borderCurve: 'continuous' },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingHorizontal: space.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  punto: { width: 9, height: 9, borderRadius: 5 },
});
