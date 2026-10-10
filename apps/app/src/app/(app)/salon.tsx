import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutGrid, PencilRuler } from 'lucide-react-native';
import { useWindowDimensions } from 'react-native';
import { contarPorEstado, ESTADOS_MESA, ETIQUETA_ESTADO_MESA, ESTADOS_CON_PERSONAS, planoDesdeMesas, type EstadoMesa, type Mesa } from '@vase/domain';
import { Button, Chip, EmptyState, ErrorBanner, Group, Row, Screen, Segmented, Skeleton, StatusPill, Text, space, useEstadoColor, useTheme } from '@vase/ui';
import { MesaSheet } from '@/components/MesaSheet';
import { PlanoCanvas, type Seleccion } from '@/components/plano/PlanoCanvas';
import { useMesas, usePedidosActivos, usePlano } from '@/lib/queries';
import { useSession } from '@/lib/session';

type Vista = 'plano' | 'lista';

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
  const { height } = useWindowDimensions();
  const [vista, setVista] = useState<Vista>('plano');
  const [filtro, setFiltro] = useState<EstadoMesa | 'todas'>('todas');
  const [zona, setZona] = useState<string>('todas');
  const [elegida, setElegida] = useState<Mesa | null>(null);

  const mesas = useMemo(() => mesasQ.data ?? [], [mesasQ.data]);
  const zonas = useMemo(() => [...new Set(mesas.map((m) => m.zona))], [mesas]);
  const delaZona = useMemo(() => (zona === 'todas' ? mesas : mesas.filter((m) => m.zona === zona)), [mesas, zona]);
  const conteo = useMemo(() => contarPorEstado(delaZona), [delaZona]);
  const visibles = useMemo(() => (filtro === 'todas' ? null : new Set(delaZona.filter((m) => m.estado === filtro).map((m) => m.id))), [delaZona, filtro]);
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
    return new Set(mesas.filter((m) => (filtro === 'todas' || m.estado === filtro) && (zona === 'todas' || m.zona === zona)).map((m) => m.id));
  }, [mesas, filtro, zona]);
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
      headerRight={puedeEditar ? <Button label="Editar plano" size="sm" variant="tinted" icon={<PencilRuler size={16} color={colors.tint} />} onPress={() => router.push('/editor-plano')} /> : undefined}
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
              {presentes.map((estado) => (
                <Chip key={estado} label={ETIQUETA_ESTADO_MESA[estado]} count={conteo[estado]} selected={filtro === estado} onPress={() => setFiltro(estado)} />
              ))}
            </ScrollView>
          </View>

          {vista === 'plano' ? (
            <View style={styles.stack}>
              <View onLayout={(e) => setAnchoMarco(e.nativeEvent.layout.width)} style={[styles.marcoPlano, { height: altoPlano, backgroundColor: colors.surface }]}>
                <PlanoCanvas plano={plano} info={infoMesa} modo="servicio" seleccion={elegida ? { tipo: 'mesa', id: elegida.id } : null} onSeleccionar={seleccionar} visibles={visiblesPlano} />
              </View>
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

      <MesaSheet mesa={elegida} pedido={pedidoDe(elegida)} onClose={() => setElegida(null)} onTomarPedido={tomarPedido} onCobrar={cobrar} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
  controles: { gap: space.md },
  segmento: { maxWidth: 280 },
  chips: { gap: space.sm, paddingRight: space.xl },
  marcoPlano: { borderRadius: 18, overflow: 'hidden', borderCurve: 'continuous' },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingHorizontal: space.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  punto: { width: 9, height: 9, borderRadius: 5 },
});
