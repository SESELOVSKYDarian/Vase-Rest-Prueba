import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCodeSvg from 'react-native-qrcode-svg';
import { ChevronLeft, Printer } from 'lucide-react-native';
import { Button, ErrorBanner, Field, Group, PressableScale, Text, haptic, radius, space, useTheme } from '@vase/ui';
import { esUrlValida, htmlQrs, imprimir, linkCarta, urlCartaPorDefecto } from '@/lib/carta';
import { useMesas } from '@/lib/queries';
import { useSession } from '@/lib/session';

export default function QrMesasPantalla() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, sizeClass } = useTheme();
  const mesasQ = useMesas();
  const urlGuardada = useSession((s) => s.urlCarta);
  const setUrlCarta = useSession((s) => s.setUrlCarta);
  const servidor = useSession((s) => s.servidor);
  const [borrador, setBorrador] = useState(urlGuardada || urlCartaPorDefecto());
  const [imprimiendo, setImprimiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = (urlGuardada || urlCartaPorDefecto()).replace(/\/+$/, '');
  const baseValida = esUrlValida(base);
  const mesas = useMemo(() => [...(mesasQ.data ?? [])].sort((a, b) => a.numero - b.numero), [mesasQ.data]);
  const links = useMemo(() => (baseValida ? mesas.map((m) => ({ numero: m.numero, link: linkCarta(base, m.numero, servidor || undefined) })) : []), [base, baseValida, mesas, servidor]);

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/menu'));
  const guardarUrl = () => {
    if (!esUrlValida(borrador.trim())) { setError('Escribí una dirección completa, por ejemplo https://carta.milocal.com.ar'); haptic.error(); return; }
    setError(null);
    setUrlCarta(borrador);
    haptic.ligero();
  };
  const imprimirTodo = async () => {
    setError(null);
    setImprimiendo(true);
    try {
      await imprimir(await htmlQrs(links));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo imprimir');
    } finally {
      setImprimiendo(false);
    }
  };

  const [anchoGrilla, setAnchoGrilla] = useState(0);
  const columnas = anchoGrilla > 900 ? 4 : anchoGrilla > 560 ? 3 : 2;
  const anchoTarjeta = anchoGrilla ? Math.floor((anchoGrilla - space.lg * (columnas - 1)) / columnas) : undefined;

  return (
    <View style={[styles.raiz, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.contenido, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space['5xl'] }]}>
        <View style={styles.ancho}>
          <PressableScale onPress={volver} accessibilityLabel="Volver" style={styles.volver}>
            <ChevronLeft size={24} color={colors.tint} />
            <Text variant="body" color="tint">Carta</Text>
          </PressableScale>
          <View style={styles.encabezado}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="largeTitle" accessibilityRole="header">QR de las mesas</Text>
              <Text variant="callout" color="secondary">Cada mesa tiene su QR. El cliente lo escanea con la cámara y ve la carta con fotos y precios, sin instalar nada.</Text>
            </View>
            {sizeClass !== 'compact' ? <Button label="Imprimir todos" icon={<Printer size={18} color={colors.onTint} />} loading={imprimiendo} disabled={!links.length} onPress={imprimirTodo} /> : null}
          </View>

          <Group header="Dirección de la carta" footer="Donde está publicada la versión web de Vase Rest. Si cambia, hay que volver a imprimir los QR.">
            <Field label="Dirección" value={borrador} onChangeText={setBorrador} onBlur={guardarUrl} onSubmitEditing={guardarUrl} placeholder="https://carta.milocal.com.ar" autoCapitalize="none" autoCorrect={false} keyboardType="url" inputMode="url" />
          </Group>

          {error ? <ErrorBanner message={error} /> : null}
          {sizeClass === 'compact' ? <Button label="Imprimir todos" size="lg" full icon={<Printer size={18} color={colors.onTint} />} loading={imprimiendo} disabled={!links.length} onPress={imprimirTodo} /> : null}

          {mesasQ.isPending ? (
            <ActivityIndicator color={colors.tint} />
          ) : !baseValida ? (
            <Text variant="callout" color="secondary">Escribí la dirección de la carta para generar los QR.</Text>
          ) : (
            <View style={styles.grilla} onLayout={(e) => setAnchoGrilla(e.nativeEvent.layout.width)}>
              {links.map((m) => (
                <View key={m.numero} style={[styles.tarjeta, { backgroundColor: colors.surface, width: anchoTarjeta }]} accessibilityLabel={`QR de la mesa ${m.numero}`}>
                  <Text variant="footnote" color="secondary" weight="600">MESA</Text>
                  <Text variant="title1" weight="700" numeric>{m.numero}</Text>
                  <View style={styles.qr}>
                    <QRCodeSvg value={m.link} size={sizeClass === 'compact' ? 120 : 148} color="#1C1C1E" backgroundColor="#FFFFFF" />
                  </View>
                  <Text variant="caption" color="secondary" numberOfLines={1} selectable>{m.link.replace(/^https?:\/\//, '')}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  contenido: { paddingHorizontal: space.xl, alignItems: 'center' },
  ancho: { width: '100%', maxWidth: 1080, gap: space.xl },
  volver: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, marginLeft: -space.sm, paddingRight: space.md },
  encabezado: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xl },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  tarjeta: { alignItems: 'center', gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous' },
  // Fondo blanco siempre: un QR invertido (modo oscuro) no lo leen todas las cámaras.
  qr: { padding: space.md, backgroundColor: '#FFFFFF', borderRadius: radius.md, marginVertical: space.sm },
});
