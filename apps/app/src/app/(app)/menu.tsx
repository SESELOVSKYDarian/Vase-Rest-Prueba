import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, ExternalLink, Plus, QrCode, Search } from 'lucide-react-native';
import type { ProductoMenu } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Button, Chip, EmptyState, ErrorBanner, Group, PressableScale, Row, Screen, Skeleton, Text, Toast, fontFor, radius, space, useTheme } from '@vase/ui';
import { EditarPlatoSheet } from '@/components/EditarPlatoSheet';
import { FotoPlato } from '@/components/FotoPlato';
import { useCategorias, useProductos } from '@/lib/queries';
import { useSession } from '@/lib/session';

/** Sin tildes ni mayúsculas, para buscar "milanesa" y encontrar "Milanesa". */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function MenuPantalla() {
  const router = useRouter();
  const { colors, sizeClass } = useTheme();
  const productosQ = useProductos();
  const categoriasQ = useCategorias();
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>('todas');
  const [editando, setEditando] = useState<ProductoMenu | 'nuevo' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const rol = useSession((st) => st.usuario?.rol);

  const productos = useMemo(() => productosQ.data ?? [], [productosQ.data]);
  const categorias = useMemo(() => categoriasQ.data ?? [], [categoriasQ.data]);
  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return productos.filter((p) => (categoria === 'todas' || p.categoriaId === categoria) && (!q || normalizar(`${p.nombre} ${p.descripcion}`).includes(q)));
  }, [productos, busqueda, categoria]);
  const secciones = useMemo(() => {
    const grupos = categorias.map((c) => ({ id: c.id, titulo: c.nombre, platos: filtrados.filter((p) => p.categoriaId === c.id) }));
    const sinCategoria = filtrados.filter((p) => !p.categoriaId || !categorias.some((c) => c.id === p.categoriaId));
    if (sinCategoria.length) grupos.push({ id: 'otros', titulo: 'Sin categoría', platos: sinCategoria });
    return grupos.filter((g) => g.platos.length > 0);
  }, [categorias, filtrados]);

  const agotados = productos.filter((p) => !p.disponible).length;
  const sinFoto = productos.filter((p) => !p.imagenUrl).length;
  const subtitulo = productos.length ? `${productos.length} platos${agotados ? ` · ${agotados} agotado${agotados > 1 ? 's' : ''}` : ''}` : undefined;
  const grilla = sizeClass !== 'compact';
  // Columnas parejas (la última fila no se estira): el ancho sale del espacio disponible.
  const [anchoGrilla, setAnchoGrilla] = useState(0);
  const columnas = anchoGrilla > 900 ? 3 : 2;
  const anchoTarjeta = anchoGrilla ? Math.floor((anchoGrilla - space.lg * (columnas - 1)) / columnas) : undefined;

  if (rol !== 'admin' && rol !== 'encargado') {
    return (
      <Screen title="Carta">
        <EmptyState icon={<BookOpen size={30} color={colors.labelSecondary} />} title="Solo para encargados" message="La carta la editan el encargado o el administrador del local." />
      </Screen>
    );
  }

  return (
    <>
      <Screen
        title="Carta"
        subtitle={subtitulo}
        bottomInset={sizeClass === 'compact' ? 72 : 0}
        refreshing={productosQ.isRefetching}
        onRefresh={() => { void productosQ.refetch(); void categoriasQ.refetch(); }}
        headerRight={<Button label="Nuevo plato" size="sm" icon={<Plus size={16} color={colors.onTint} />} onPress={() => setEditando('nuevo')} />}
      >
        <View style={styles.pila} onLayout={(e) => setAnchoGrilla(e.nativeEvent.layout.width)}>
          <Group footer={sinFoto ? `${sinFoto} ${sinFoto === 1 ? 'plato no tiene' : 'platos no tienen'} foto. Con foto se piden más desde el QR.` : undefined}>
            <Row
              title="QR de las mesas"
              subtitle="La carta con fotos en el celular de cada cliente, sin instalar nada"
              leading={<View style={[styles.icono, { backgroundColor: colors.tintSoft }]}><QrCode size={20} color={colors.tint} /></View>}
              chevron
              onPress={() => router.push('/qr-mesas')}
            />
            <Row
              title="Ver la carta como cliente"
              leading={<View style={[styles.icono, { backgroundColor: colors.fill }]}><ExternalLink size={19} color={colors.label} /></View>}
              chevron
              onPress={() => router.push('/carta')}
            />
          </Group>

          <View style={[styles.buscador, { backgroundColor: colors.fill }]}>
            <Search size={18} color={colors.labelSecondary} />
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar en la carta"
              placeholderTextColor={colors.labelSecondary}
              accessibilityLabel="Buscar en la carta"
              selectionColor={colors.tint}
              style={[styles.input, fontFor('400'), { color: colors.label }]}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Todo" selected={categoria === 'todas'} onPress={() => setCategoria('todas')} />
            {categorias.map((c) => <Chip key={c.id} label={c.nombre} selected={categoria === c.id} onPress={() => setCategoria(c.id)} />)}
          </ScrollView>

          {productosQ.isPending ? (
            <View style={styles.pila}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={76} rounded={radius.lg} />)}</View>
          ) : productosQ.isError ? (
            <ErrorBanner message="No se pudo cargar la carta" action={<Button label="Reintentar" size="sm" variant="tinted" onPress={() => void productosQ.refetch()} />} />
          ) : productos.length === 0 ? (
            <EmptyState icon={<BookOpen size={30} color={colors.labelSecondary} />} title="La carta está vacía" message="Cargá el primer plato con su foto y su precio." action={<Button label="Nuevo plato" onPress={() => setEditando('nuevo')} />} />
          ) : secciones.length === 0 ? (
            <EmptyState icon={<Search size={30} color={colors.labelSecondary} />} title="Sin resultados" message={`No hay platos que coincidan con “${busqueda}”.`} />
          ) : (
            secciones.map((s) => (
              <View key={s.id} style={styles.seccion}>
                <Text variant="title3" accessibilityRole="header" style={styles.tituloSeccion}>{s.titulo}</Text>
                {grilla ? (
                  <View style={styles.grilla}>
                    {s.platos.map((p) => <TarjetaPlato key={p.id} plato={p} ancho={anchoTarjeta} onPress={() => setEditando(p)} />)}
                  </View>
                ) : (
                  <Group>
                    {s.platos.map((p) => (
                      <Row
                        key={p.id}
                        title={p.nombre}
                        leading={<FotoPlato ruta={p.imagenUrl} ancho={60} radio={12} />}
                        detail={<DetallePlato plato={p} />}
                        chevron
                        onPress={() => setEditando(p)}
                        accessibilityLabel={`Editar ${p.nombre}`}
                      />
                    ))}
                  </Group>
                )}
              </View>
            ))
          )}
        </View>
      </Screen>
      <EditarPlatoSheet plato={editando} categorias={categorias} onClose={() => setEditando(null)} onGuardado={(m) => { setEditando(null); setAviso(m); }} />
      <Toast message={aviso} onHide={() => setAviso(null)} />
    </>
  );
}

function DetallePlato({ plato }: { plato: ProductoMenu }) {
  return (
    <View style={styles.detalle}>
      <Text variant="subhead" weight="600" numeric>{formatearARS(plato.precio, true)}</Text>
      {!plato.disponible ? <Text variant="footnote" weight="600" color="danger">Agotado</Text> : null}
      {plato.descripcion ? <Text variant="footnote" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>{plato.descripcion}</Text> : null}
    </View>
  );
}

function TarjetaPlato({ plato, ancho, onPress }: { plato: ProductoMenu; ancho?: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} accessibilityLabel={`Editar ${plato.nombre}`} style={[styles.tarjeta, { backgroundColor: colors.surface, width: ancho }]}>
      <FotoPlato ruta={plato.imagenUrl} ancho={400} alto={170} radio={0} style={styles.fotoTarjeta} />
      {!plato.disponible ? (
        <View style={[styles.agotado, { backgroundColor: colors.surface }]}><Text variant="caption" weight="700" color="danger">AGOTADO</Text></View>
      ) : null}
      <View style={styles.textoTarjeta}>
        <View style={styles.filaTarjeta}>
          <Text variant="headline" numberOfLines={1} style={{ flex: 1 }}>{plato.nombre}</Text>
          <Text variant="headline" numeric>{formatearARS(plato.precio, true)}</Text>
        </View>
        <Text variant="footnote" color="secondary" numberOfLines={2}>{plato.descripcion || 'Sin descripción'}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.xl },
  icono: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, minHeight: 44 },
  input: { flex: 1, fontSize: 17, paddingVertical: space.sm, outlineStyle: 'none' as never },
  chips: { gap: space.sm, paddingRight: space.xl },
  seccion: { gap: space.md },
  tituloSeccion: { paddingHorizontal: space.xs },
  detalle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  tarjeta: { borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous' },
  fotoTarjeta: { width: '100%' },
  agotado: { position: 'absolute', top: space.md, left: space.md, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  textoTarjeta: { padding: space.lg, gap: space.xs },
  filaTarjeta: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
