import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarCheck, CheckCircle2 } from 'lucide-react-native';
import { configureApi, normalizarUrlServidor, obtenerPlanoParaReservar, reservarDesdePlano, type MesaParaReservar } from '@vase/api';
import { normalizarPlano, planoDesdeMesas, type Mesa } from '@vase/domain';
import { Button, ErrorBanner, Group, Row, Sheet, Skeleton, Text, fontFor, haptic, radius, space, useTheme } from '@vase/ui';
import { PlanoCanvas } from '@/components/plano/PlanoCanvas';
import { useSession } from '@/lib/session';

/**
 * Reservar eligiendo la mesa en el plano real del local. La abre quien recibe el enlace del asistente de
 * WhatsApp (viene con el día, la hora y la cantidad ya definidos); no necesita cuenta ni app.
 */
export default function Reservar() {
  const { t, s } = useLocalSearchParams<{ t?: string; s?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const token = useSession((st) => st.token);
  useState(() => {
    if (!token && s) {
      const url = normalizarUrlServidor(s);
      if (/^https?:\/\/[^/\s]+/i.test(url)) configureApi({ baseUrl: url });
    }
    return null;
  });

  const q = useQuery({ queryKey: ['reservar', t], queryFn: () => obtenerPlanoParaReservar(t!), enabled: !!t, retry: false });
  const [elegida, setElegida] = useState<MesaParaReservar | null>(null);
  const [nombre, setNombre] = useState('');
  const datos = q.data;

  const plano = useMemo(() => {
    if (!datos) return null;
    const guardado = normalizarPlano(datos.plano);
    if (guardado) return guardado;
    return planoDesdeMesas(datos.mesas.map((m): Mesa => ({ id: m.id, numero: m.numero, zona: m.zona ?? 'Salón', estado: 'libre', capacidad: m.capacidad, forma: m.forma === 'cuadrada' ? 'cuadrada' : m.forma === 'rectangular' ? 'rectangular' : 'circular', posicion: { x: m.posX, y: m.posY } })));
  }, [datos]);
  const porId = useMemo(() => new Map((datos?.mesas ?? []).map((m) => [m.id, m])), [datos]);
  const libres = useMemo(() => new Set((datos?.mesas ?? []).filter((m) => m.libre).map((m) => m.id)), [datos]);

  const reservar = useMutation({
    mutationFn: () => reservarDesdePlano(t!, elegida!.id, nombre.trim() || datos?.pedido.nombre || ''),
    onSuccess: () => haptic.exito(),
    onError: () => haptic.error(),
  });

  if (!t) return <Aviso titulo="Falta el enlace" mensaje="Abrí el enlace que te mandó el asistente por WhatsApp." />;
  if (q.isError) return <Aviso titulo="Este enlace ya no sirve" mensaje={q.error instanceof Error ? q.error.message : 'Volvé a pedir tu reserva por WhatsApp.'} />;
  if (reservar.isSuccess) return <Aviso ok titulo="¡Pedido enviado!" mensaje={`Pediste la mesa ${reservar.data.mesa} ${datos?.pedido.cuando ?? ''}. El local la confirma en breve y te avisa por WhatsApp. Ya podés cerrar esta pantalla.`} />;

  const seleccion = elegida ? { tipo: 'mesa' as const, id: elegida.id } : null;
  return (
    <View style={[styles.raiz, { backgroundColor: colors.bg, paddingTop: insets.top + space.lg }]}>
      <ScrollView contentContainerStyle={[styles.cuerpo, { paddingBottom: insets.bottom + space['3xl'] }]} showsVerticalScrollIndicator={false}>
        {!datos || !plano ? (
          <View style={{ gap: space.lg }}><Skeleton height={34} width="60%" /><Skeleton height={420} rounded={18} /></View>
        ) : (
          <>
            <View style={{ gap: space.xs }}>
              <Text variant="largeTitle" accessibilityRole="header">Elegí tu mesa</Text>
              <Text variant="callout" color="secondary">{`${datos.local || 'El local'} · ${datos.pedido.cuando} · ${datos.pedido.personas} ${datos.pedido.personas === 1 ? 'persona' : 'personas'}`}</Text>
            </View>
            <View style={[styles.marco, { backgroundColor: colors.surface }]}>
              <PlanoCanvas
                plano={plano}
                modo="servicio"
                info={(id) => { const m = porId.get(id); return m ? { numero: m.numero, estado: m.libre ? 'libre' : 'ocupada', detalle: m.libre ? `${m.capacidad} lug.` : undefined } : null; }}
                seleccion={seleccion}
                visibles={libres}
                onSeleccionar={(sel) => { if (sel?.tipo === 'mesa' && libres.has(sel.id)) { haptic.seleccion(); setElegida(porId.get(sel.id) ?? null); } }}
              />
            </View>
            {datos.mesas.some((m) => m.libre) ? (
              <Group header="O elegí de la lista">
                {datos.mesas.filter((m) => m.libre).map((m) => (
                  <Row key={m.id} title={`Mesa ${m.numero}`} subtitle={`${m.zona ?? 'Salón'} · hasta ${m.capacidad} personas`} chevron onPress={() => { haptic.seleccion(); setElegida(m); }} />
                ))}
              </Group>
            ) : null}
            <Text variant="footnote" color="secondary">{datos.mesas.some((m) => m.libre) ? 'Tocá una mesa para reservarla. Las que se ven apagadas no están disponibles en ese horario o son muy chicas para tu grupo.' : 'No quedan mesas libres para ese horario: volvé al chat y probá otro.'}</Text>
          </>
        )}
      </ScrollView>

      <Sheet open={!!elegida} onClose={() => setElegida(null)} title={elegida ? `Mesa ${elegida.numero}` : undefined}>
        {elegida && datos ? (
          <View style={{ gap: space.lg, paddingBottom: space.lg }}>
            <View style={[styles.resumen, { backgroundColor: colors.surface }]}>
              <CalendarCheck size={22} color={colors.tint} />
              <View style={{ flex: 1 }}>
                <Text variant="headline">{datos.pedido.cuando}</Text>
                <Text variant="footnote" color="secondary">{`${elegida.zona ?? 'Salón'} · hasta ${elegida.capacidad} personas · te la guardamos ${Math.round(datos.duracionMin / 60 * 10) / 10} h`}</Text>
              </View>
            </View>
            <TextInput value={nombre} onChangeText={setNombre} placeholder={datos.pedido.nombre || 'Tu nombre'} placeholderTextColor={colors.labelTertiary} selectionColor={colors.tint} autoComplete="name" accessibilityLabel="Nombre para la reserva" style={[styles.input, fontFor('500'), { backgroundColor: colors.fillSoft, color: colors.label }]} />
            {reservar.isError ? <ErrorBanner message={reservar.error instanceof Error ? reservar.error.message : 'No se pudo reservar'} /> : null}
            <Button label="Pedir esta mesa" size="lg" full loading={reservar.isPending} disabled={!(nombre.trim() || datos.pedido.nombre)} onPress={() => reservar.mutate()} />
            <Text variant="footnote" color="secondary" align="center">La reserva queda pendiente hasta que el local la confirme.</Text>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function Aviso({ titulo, mensaje, ok }: { titulo: string; mensaje: string; ok?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.raiz, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xxl, paddingTop: insets.top }]}>
      {ok ? <CheckCircle2 size={56} color={colors.tint} /> : null}
      <Text variant="title1" align="center" style={{ marginTop: space.lg }}>{titulo}</Text>
      <Text variant="callout" color="secondary" align="center" style={{ marginTop: space.sm, maxWidth: 420 }}>{mensaje}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cuerpo: { gap: space.lg, paddingHorizontal: space.xl, width: '100%', maxWidth: 820, alignSelf: 'center' },
  marco: { height: 460, borderRadius: 18, overflow: 'hidden', borderCurve: 'continuous' },
  resumen: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous' },
  input: { fontSize: 17, padding: space.lg, borderRadius: radius.md, outlineStyle: 'none' as never },
});
