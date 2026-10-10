import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { configureApi, normalizarUrlServidor, obtenerCartaPublica, type ProductoMenu } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Button, Chip, ErrorBanner, PressableScale, Sheet, Skeleton, Text, radius, space, useTheme } from '@vase/ui';
import { FotoPlato } from '@/components/FotoPlato';
import { useSession } from '@/lib/session';

/**
 * Carta pública: la abre el cliente desde el QR de su mesa, sin cuenta ni app.
 * Solo lectura: muestra lo que está en la carta, con fotos y precios del momento.
 */
export default function CartaPublica() {
  const { mesa, s } = useLocalSearchParams<{ mesa?: string; s?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, sizeClass } = useTheme();
  const token = useSession((st) => st.token);

  // El QR puede traer el servidor del local (cuando no es el que la web deduce sola).
  useState(() => {
    if (!token && s) {
      const url = normalizarUrlServidor(s);
      if (/^https?:\/\/[^/\s]+/i.test(url)) configureApi({ baseUrl: url });
    }
    return null;
  });

  const cartaQ = useQuery({ queryKey: ['carta-publica'], queryFn: obtenerCartaPublica, staleTime: 30_000, refetchInterval: 60_000 });
  const [elegido, setElegido] = useState<ProductoMenu | null>(null);
  const scroll = useRef<ScrollView>(null);
  const posiciones = useRef<Record<string, number>>({});
  const [activa, setActiva] = useState<string | null>(null);

  const secciones = useMemo(() => {
    const datos = cartaQ.data;
    if (!datos) return [];
    const grupos = datos.categorias.map((c) => ({ id: c.id, titulo: c.nombre, platos: datos.productos.filter((p) => p.categoriaId === c.id) }));
    const otros = datos.productos.filter((p) => !datos.categorias.some((c) => c.id === p.categoriaId));
    if (otros.length) grupos.push({ id: 'otros', titulo: 'Más', platos: otros });
    return grupos.filter((g) => g.platos.length);
  }, [cartaQ.data]);

  const numeroMesa = mesa && /^\d{1,4}$/.test(mesa) ? Number(mesa) : null;
  const irA = (id: string) => {
    setActiva(id);
    const y = posiciones.current[id];
    if (y != null) scroll.current?.scrollTo({ y: Math.max(0, y - 64), animated: true });
  };
  const anchoFoto = sizeClass === 'compact' ? 92 : 112;

  return (
    <View style={[styles.raiz, { backgroundColor: colors.bg }]}>
      <ScrollView ref={scroll} stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: insets.bottom + space['5xl'] }}>
        <View style={[styles.ancho, styles.cabecera, { paddingTop: insets.top + space['3xl'] }]}>
          {numeroMesa ? (
            <View style={[styles.pastillaMesa, { backgroundColor: colors.tintSoft }]}>
              <Text variant="subhead" weight="600" color="tint">Mesa {numeroMesa}</Text>
            </View>
          ) : null}
          <Text variant="largeTitle" accessibilityRole="header">Nuestra carta</Text>
          <Text variant="callout" color="secondary">Elegí tranquilo. Cuando quieras pedir, llamá a tu mozo.</Text>
        </View>

        <View style={[styles.barraCategorias, { backgroundColor: colors.bg, borderBottomColor: colors.separator }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, styles.ancho]}>
            {secciones.map((sec) => <Chip key={sec.id} label={sec.titulo} selected={activa === sec.id} onPress={() => irA(sec.id)} />)}
          </ScrollView>
        </View>

        <View style={[styles.ancho, styles.cuerpo]}>
          {cartaQ.isPending ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} height={110} rounded={radius.lg} />)
          ) : cartaQ.isError ? (
            <ErrorBanner message="No pudimos cargar la carta. Revisá tu conexión." action={<Button label="Reintentar" size="sm" variant="tinted" onPress={() => void cartaQ.refetch()} />} />
          ) : secciones.length === 0 ? (
            <Text variant="callout" color="secondary" align="center">La carta todavía no está cargada. Pedile la carta a tu mozo.</Text>
          ) : (
            secciones.map((sec) => (
              <View key={sec.id} style={styles.seccion} onLayout={(e) => { posiciones.current[sec.id] = e.nativeEvent.layout.y; }}>
                <Text variant="title2" accessibilityRole="header" style={styles.tituloSeccion}>{sec.titulo}</Text>
                <View style={[styles.lista, { backgroundColor: colors.surface }]}>
                  {sec.platos.map((p, i) => (
                    <View key={p.id}>
                      {i > 0 ? <View style={[styles.separador, { backgroundColor: colors.separator }]} /> : null}
                      <PressableScale onPress={() => setElegido(p)} scaleTo={0.99} accessibilityLabel={`${p.nombre}, ${formatearARS(p.precio, true)}${p.disponible ? '' : ', agotado'}`} style={[styles.plato, !p.disponible && styles.agotado]}>
                        <View style={styles.textoPlato}>
                          <Text variant="headline">{p.nombre}</Text>
                          {p.descripcion ? <Text variant="subhead" color="secondary" numberOfLines={2}>{p.descripcion}</Text> : null}
                          <View style={styles.filaPrecio}>
                            <Text variant="callout" weight="600" numeric>{formatearARS(p.precio, true)}</Text>
                            {!p.disponible ? <Text variant="footnote" weight="600" color="danger">Agotado</Text> : null}
                          </View>
                        </View>
                        {p.imagenUrl ? <FotoPlato ruta={p.imagenUrl} ancho={anchoFoto} radio={14} /> : null}
                      </PressableScale>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
          {secciones.length ? <Text variant="footnote" color="secondary" align="center" style={styles.pie}>Precios en pesos argentinos. Consultá por opciones sin TACC o vegetarianas.</Text> : null}
        </View>
      </ScrollView>

      <Sheet open={!!elegido} onClose={() => setElegido(null)}>
        {elegido ? (
          <View style={styles.detalle}>
            {elegido.imagenUrl ? <FotoPlato ruta={elegido.imagenUrl} ancho={480} alto={280} radio={radius.lg} style={{ width: '100%' }} /> : null}
            <View style={{ gap: space.sm }}>
              <Text variant="title2">{elegido.nombre}</Text>
              {elegido.descripcion ? <Text variant="body" color="secondary">{elegido.descripcion}</Text> : null}
              <View style={styles.filaPrecio}>
                <Text variant="title3" numeric>{formatearARS(elegido.precio, true)}</Text>
                {!elegido.disponible ? <Text variant="subhead" weight="600" color="danger">Agotado por hoy</Text> : null}
              </View>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  ancho: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: space.xl },
  cabecera: { gap: space.sm, paddingBottom: space.xl },
  pastillaMesa: { alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, marginBottom: space.xs },
  barraCategorias: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.md },
  chips: { gap: space.sm },
  cuerpo: { gap: space['3xl'], paddingTop: space.xl },
  seccion: { gap: space.md },
  tituloSeccion: { paddingHorizontal: space.xs },
  lista: { borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous' },
  separador: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  plato: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  agotado: { opacity: 0.5 },
  textoPlato: { flex: 1, gap: space.xs },
  filaPrecio: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xxs },
  pie: { paddingHorizontal: space.xl },
  detalle: { gap: space.lg, paddingBottom: space.md },
});
