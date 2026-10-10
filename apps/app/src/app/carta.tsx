import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Receipt, Sparkles } from 'lucide-react-native';
import { configureApi, normalizarUrlServidor, obtenerCartaPublica, obtenerMesaQr, type Etiqueta, type Idioma, type ProductoCarta } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Button, Chip, ErrorBanner, PressableScale, Segmented, Skeleton, Text, haptic, radius, space, useTheme } from '@vase/ui';
import { AsistenteGustos } from '@/components/cliente/AsistenteGustos';
import { Cuenta } from '@/components/cliente/Cuenta';
import { DetallePlato } from '@/components/cliente/DetallePlato';
import { MiPedido } from '@/components/cliente/MiPedido';
import { PlatoFila } from '@/components/cliente/PlatoFila';
import { guardarIdioma, idiomaGuardado, useCliente } from '@/lib/cliente';
import { describirDias, idiomaInicial, textosDe } from '@/lib/i18n';
import { useSession } from '@/lib/session';

type Pestana = 'carta' | 'pedido' | 'cuenta';

/**
 * Carta pública: la abre el cliente desde el QR de su mesa, sin cuenta ni app.
 * Sin mesa en la dirección es solo una carta para mirar; con mesa también permite pedir y pagar.
 */
export default function CartaPublica() {
  const { mesa, s, pago } = useLocalSearchParams<{ mesa?: string; s?: string; pago?: string }>();
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

  const numeroMesa = mesa && /^\d{1,4}$/.test(mesa) ? Number(mesa) : null;
  const [idioma, setIdioma] = useState<Idioma>(() => idiomaGuardado() ?? 'es');
  const [pestana, setPestana] = useState<Pestana>(pago ? 'cuenta' : 'carta');
  const [categoria, setCategoria] = useState<string>('todas');
  const [filtros, setFiltros] = useState<Etiqueta[]>([]);
  const [detalle, setDetalle] = useState<ProductoCarta | null>(null);
  const [asistente, setAsistente] = useState(false);
  const cliente = useCliente();

  const cartaQ = useQuery({ queryKey: ['carta-publica', idioma], queryFn: () => obtenerCartaPublica(idioma), staleTime: 30_000, refetchInterval: 60_000, placeholderData: keepPreviousData });
  const mesaQ = useQuery({ queryKey: ['mesa-qr', numeroMesa], queryFn: () => obtenerMesaQr(numeroMesa!), enabled: numeroMesa !== null, refetchInterval: 6000 });
  const carta = cartaQ.data;
  const textos = textosDe(idioma);

  // Primera visita: si el celular está en inglés o portugués y la carta lo ofrece, arranca en ese idioma.
  useEffect(() => {
    if (!carta || idiomaGuardado()) return;
    const sugerido = idiomaInicial(carta.idiomas, globalThis.navigator?.language);
    if (sugerido !== 'es') setIdioma(sugerido);
  }, [carta?.idiomas]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarIdioma = (i: Idioma) => { setIdioma(i); guardarIdioma(i); haptic.seleccion(); };

  const porId = useMemo(() => new Map((carta?.productos ?? []).map((p) => [p.id, p])), [carta]);
  const etiquetasUsadas = useMemo(() => (['sin_tacc', 'vegano', 'vegetariano', 'sin_lactosa', 'picante'] as Etiqueta[]).filter((e) => carta?.productos.some((p) => p.etiquetas.includes(e))), [carta]);
  const visibles = useMemo(
    () => (carta?.productos ?? []).filter((p) => (categoria === 'todas' || p.categoriaId === categoria) && filtros.every((f) => p.etiquetas.includes(f) || (f === 'vegetariano' && p.etiquetas.includes('vegano')))),
    [carta, categoria, filtros],
  );
  const secciones = useMemo(() => {
    if (!carta) return [];
    const masPedidos = categoria === 'todas' && filtros.length === 0 ? visibles.filter((p) => p.masPedido && p.disponible) : [];
    const grupos = carta.categorias.map((c) => ({ id: c.id, titulo: c.nombre, platos: visibles.filter((p) => p.categoriaId === c.id) }));
    const otros = visibles.filter((p) => !carta.categorias.some((c) => c.id === p.categoriaId));
    if (otros.length) grupos.push({ id: 'otros', titulo: '·', platos: otros });
    return [...(masPedidos.length ? [{ id: 'mas-pedidos', titulo: textos.masPedidos, platos: masPedidos }] : []), ...grupos].filter((g) => g.platos.length);
  }, [carta, visibles, categoria, filtros, textos]);

  const puedePedir = numeroMesa !== null && !!carta?.pedidosQr;
  const cantidadDe = (id: string) => cliente.lineas.find((l) => l.productoId === id)?.cantidad ?? 0;
  const unidades = cliente.lineas.reduce((s2, l) => s2 + l.cantidad, 0);
  const totalEstimado = cliente.lineas.reduce((s2, l) => s2 + (porId.get(l.productoId)?.precio ?? 0) * l.cantidad, 0);
  const agregar = (p: ProductoCarta) => { cliente.agregar(p.id); };
  const anchoFoto = sizeClass === 'compact' ? 92 : 112;
  const hh = carta?.happyHour;
  const hoy = new Date().getDay();
  const mostrarHappy = !!hh?.activo && (hh.vigente || hh.dias.includes(hoy));

  const pestanas = numeroMesa !== null
    ? [{ value: 'carta' as const, label: textos.tabCarta }, { value: 'pedido' as const, label: unidades ? `${textos.tabPedido} · ${unidades}` : textos.tabPedido }, { value: 'cuenta' as const, label: textos.tabCuenta }]
    : null;

  return (
    <View style={[styles.raiz, { backgroundColor: colors.bg }]}>
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: insets.bottom + 140 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.ancho, styles.cabecera, { paddingTop: insets.top + space.xxl }]}>
          <View style={styles.filaTop}>
            {numeroMesa !== null ? <View style={[styles.pastillaMesa, { backgroundColor: colors.tintSoft }]}><Text variant="subhead" weight="600" color="tint">{textos.mesa(numeroMesa)}</Text></View> : <View />}
            {carta && carta.idiomas.length > 1 ? (
              <View style={styles.idiomas}>
                {carta.idiomas.map((i) => <Chip key={i} label={i.toUpperCase()} selected={idioma === i} onPress={() => cambiarIdioma(i)} />)}
              </View>
            ) : null}
          </View>
          <Text variant="largeTitle" accessibilityRole="header">{carta?.local ? carta.local : textos.titulo}</Text>
          {carta?.local ? <Text variant="title3" color="secondary">{textos.titulo}</Text> : null}
          <Text variant="callout" color="secondary">{numeroMesa !== null && carta?.pedidosQr ? textos.subtitulo : textos.subtituloSinMesa}</Text>
        </View>

        <View style={[styles.barra, { backgroundColor: colors.bg, borderBottomColor: colors.separator }]}>
          <View style={[styles.ancho, { gap: space.md }]}>
            {pestanas ? <Segmented items={pestanas} value={pestana} onChange={setPestana} accessibilityLabel={textos.titulo} /> : null}
            {pestana === 'carta' && carta ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label={textos.todo} selected={categoria === 'todas'} onPress={() => setCategoria('todas')} />
                {carta.categorias.map((c) => <Chip key={c.id} label={c.nombre} selected={categoria === c.id} onPress={() => setCategoria(c.id)} />)}
              </ScrollView>
            ) : null}
          </View>
        </View>

        <View style={[styles.ancho, styles.cuerpo]}>
          {pestana === 'carta' ? (
            <>
              {mostrarHappy && hh ? (
                <View style={[styles.happy, { backgroundColor: hh.vigente ? colors.tint : colors.tintSoft }]}>
                  <Clock size={18} color={hh.vigente ? colors.onTint : colors.tint} />
                  <Text variant="subhead" weight="600" style={{ flex: 1, color: hh.vigente ? colors.onTint : colors.tint }}>
                    {hh.vigente ? textos.happyAhora(hh.descuento, hh.hasta) : textos.happyProximo(describirDias(hh.dias, textos), hh.desde, hh.hasta, hh.descuento)}
                  </Text>
                </View>
              ) : null}

              {etiquetasUsadas.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {etiquetasUsadas.map((e) => <Chip key={e} label={textos.etiqueta[e]} selected={filtros.includes(e)} onPress={() => setFiltros(filtros.includes(e) ? filtros.filter((f) => f !== e) : [...filtros, e])} />)}
                </ScrollView>
              ) : null}

              {cartaQ.isPending ? (
                [0, 1, 2, 3].map((i) => <Skeleton key={i} height={110} rounded={radius.lg} />)
              ) : cartaQ.isError && !carta ? (
                <ErrorBanner message={textos.errorCarta} action={<Button label={textos.reintentar} size="sm" variant="tinted" onPress={() => void cartaQ.refetch()} />} />
              ) : !carta || carta.productos.length === 0 ? (
                <Text variant="callout" color="secondary" align="center">{textos.cartaVacia}</Text>
              ) : secciones.length === 0 ? (
                <Text variant="callout" color="secondary" align="center">{textos.sinResultadosFiltro}</Text>
              ) : (
                secciones.map((sec) => (
                  <View key={sec.id} style={styles.seccion}>
                    {sec.titulo !== '·' ? <Text variant="title2" accessibilityRole="header" style={styles.tituloSeccion}>{sec.titulo}</Text> : null}
                    <View style={[styles.lista, { backgroundColor: colors.surface }]}>
                      {sec.platos.map((p, i) => (
                        <View key={p.id}>
                          {i > 0 ? <View style={[styles.separador, { backgroundColor: colors.separator }]} /> : null}
                          <PlatoFila plato={p} textos={textos} ancho={anchoFoto} puedePedir={puedePedir} cantidad={cantidadDe(p.id)} onAbrir={() => setDetalle(p)} onAgregar={() => agregar(p)} />
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
              {carta && carta.productos.length ? (
                <Text variant="footnote" color="secondary" align="center" style={styles.pie}>
                  {carta.ivaIncluido ? textos.preciosConIva : textos.preciosMasIva} {textos.consultarOpciones}
                </Text>
              ) : null}
            </>
          ) : null}

          {pestana === 'pedido' && numeroMesa !== null && carta ? (
            <MiPedido numeroMesa={numeroMesa} porId={porId} textos={textos} pedidosQr={carta.pedidosQr} pendientes={mesaQ.data?.solicitudesPendientes ?? 0} onIrALaCarta={() => setPestana('carta')} />
          ) : null}

          {pestana === 'cuenta' && numeroMesa !== null ? (
            mesaQ.data ? <Cuenta mesa={mesaQ.data} textos={textos} idioma={idioma} codigoPagoInicial={pago ?? null} /> : mesaQ.isError ? <ErrorBanner message={textos.error} /> : <Skeleton height={220} rounded={radius.lg} />
          ) : null}
        </View>
      </ScrollView>

      {pestana === 'carta' && carta ? (
        <View style={[styles.flotante, { bottom: insets.bottom + space.lg }]} pointerEvents="box-none">
          <PressableScale onPress={() => { haptic.ligero(); setAsistente(true); }} accessibilityLabel={textos.asistente} style={[styles.asistenteBoton, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
            <Sparkles size={18} color={colors.tint} />
            <Text variant="subhead" weight="600">{textos.asistente}</Text>
          </PressableScale>
          {puedePedir && unidades > 0 ? (
            <PressableScale onPress={() => { haptic.ligero(); setPestana('pedido'); }} accessibilityLabel={textos.miPedido} style={[styles.verPedido, { backgroundColor: colors.tint }]}>
              <Receipt size={20} color={colors.onTint} />
              <Text variant="headline" style={{ color: colors.onTint, flex: 1 }}>{`${textos.miPedido} · ${unidades}`}</Text>
              <Text variant="headline" numeric style={{ color: colors.onTint }}>{formatearARS(totalEstimado, true)}</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      <DetallePlato plato={detalle} porId={porId} textos={textos} puedePedir={puedePedir} onClose={() => setDetalle(null)} onAbrir={setDetalle} onAgregar={agregar} />
      <AsistenteGustos open={asistente} onClose={() => setAsistente(false)} idioma={idioma} textos={textos} porId={porId} puedePedir={puedePedir} onAbrir={(p) => { setAsistente(false); setDetalle(p); }} onAgregar={agregar} />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  ancho: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: space.xl },
  cabecera: { gap: space.sm, paddingBottom: space.xl },
  filaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  pastillaMesa: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  idiomas: { flexDirection: 'row', gap: space.xs },
  barra: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.md },
  chips: { gap: space.sm, paddingRight: space.xl },
  cuerpo: { gap: space.xl, paddingTop: space.xl },
  happy: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  seccion: { gap: space.md },
  tituloSeccion: { paddingHorizontal: space.xs },
  lista: { borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous' },
  separador: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  pie: { paddingHorizontal: space.xl },
  flotante: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', gap: space.md },
  asistenteBoton: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, minHeight: 48, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 6px 20px rgba(0,0,0,0.16)' },
  verPedido: { width: '100%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, minHeight: 54, borderRadius: radius.pill, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
});
