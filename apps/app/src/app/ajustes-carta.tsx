import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Star } from 'lucide-react-native';
import { guardarAjustes, obtenerResenas, type AjustesCarta } from '@vase/api';
import { Button, Chip, ErrorBanner, Field, Group, PressableScale, Row, Segmented, Sheet, Stepper, Text, Toast, haptic, radius, space, useTheme } from '@vase/ui';
import { useAjustes, useCategorias } from '@/lib/queries';

const DIAS = [{ n: 1, t: 'Lun' }, { n: 2, t: 'Mar' }, { n: 3, t: 'Mié' }, { n: 4, t: 'Jue' }, { n: 5, t: 'Vie' }, { n: 6, t: 'Sáb' }, { n: 0, t: 'Dom' }];
const PROPINAS = [0, 5, 10, 15, 20];

/** Ajustes de la carta y del QR: IVA, idiomas, pedidos, happy hour, cobro y propinas. */
export default function AjustesCarta() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const ajustesQ = useAjustes();
  const categoriasQ = useCategorias();
  const [borrador, setBorrador] = useState<AjustesCarta | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [verResenas, setVerResenas] = useState(false);

  useEffect(() => { if (ajustesQ.data && !borrador) setBorrador(ajustesQ.data.config); }, [ajustesQ.data, borrador]);
  const sucio = useMemo(() => !!borrador && !!ajustesQ.data && JSON.stringify(borrador) !== JSON.stringify(ajustesQ.data.config), [borrador, ajustesQ.data]);

  const guardar = useMutation({
    mutationFn: () => guardarAjustes(borrador!),
    onSuccess: async (r) => { haptic.exito(); setBorrador(r.config); setAviso('Ajustes guardados'); await queryClient.invalidateQueries({ queryKey: ['ajustes-carta'] }); },
    onError: () => haptic.error(),
  });
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/menu'));
  const cambiar = (parcial: Partial<AjustesCarta>) => setBorrador((b) => (b ? { ...b, ...parcial } : b));
  const cambiarHH = (parcial: Partial<AjustesCarta['happyHour']>) => setBorrador((b) => (b ? { ...b, happyHour: { ...b.happyHour, ...parcial } } : b));
  const alternar = <T,>(lista: T[], valor: T) => (lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const interruptor = (valor: boolean, onChange: (v: boolean) => void, etiqueta: string) => (
    <Switch value={valor} onValueChange={(v) => { haptic.seleccion(); onChange(v); }} trackColor={{ true: colors.tint, false: colors.fill }} accessibilityLabel={etiqueta} />
  );

  return (
    <View style={[styles.raiz, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.contenido, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.ancho}>
          <PressableScale onPress={volver} accessibilityLabel="Volver" style={styles.volver}>
            <ChevronLeft size={24} color={colors.tint} />
            <Text variant="body" color="tint">Carta</Text>
          </PressableScale>
          <Text variant="largeTitle" accessibilityRole="header">Ajustes del QR</Text>
          <Text variant="callout" color="secondary">Lo que ve y puede hacer el cliente desde el QR de la mesa.</Text>

          {ajustesQ.isPending || !borrador ? <ActivityIndicator color={colors.tint} /> : ajustesQ.isError ? <ErrorBanner message="No se pudieron cargar los ajustes" action={<Button label="Reintentar" size="sm" variant="tinted" onPress={() => void ajustesQ.refetch()} />} /> : (
            <>
              <Group header="Local">
                <Field label="Nombre" value={borrador.nombreLocal} onChangeText={(t) => cambiar({ nombreLocal: t })} placeholder="Vase Rest" />
              </Group>

              <Group header="Precios" footer={borrador.ivaIncluido ? 'La carta muestra el precio final: el IVA ya está adentro y no se suma al cobrar.' : 'Se suma 21 % de IVA al cobrar. La carta avisa que los precios son “más IVA”. Si tus precios ya incluyen IVA, activá esto para no cobrar de más.'}>
                <Row title="Los precios de la carta incluyen IVA" trailing={interruptor(borrador.ivaIncluido, (v) => cambiar({ ivaIncluido: v }), 'Precios con IVA incluido')} />
              </Group>

              <Group header="Pedidos desde el QR" footer="El cliente arma su pedido y el mozo lo confirma antes de que llegue a cocina. Apagado, el QR solo muestra la carta y permite llamar al mozo.">
                <Row title="Permitir pedir desde el celular" trailing={interruptor(borrador.pedidosQr, (v) => cambiar({ pedidosQr: v }), 'Pedidos desde el QR')} />
              </Group>

              <Group header="Idiomas" footer="La carta se traduce sola. Español siempre está.">
                <View style={styles.chips}>
                  {([['en', 'English'], ['pt', 'Português']] as const).map(([i, n]) => <Chip key={i} label={n} selected={borrador.idiomas.includes(i)} onPress={() => cambiar({ idiomas: alternar(borrador.idiomas, i) })} />)}
                </View>
              </Group>

              <Group header="Happy hour" footer="Los precios bajan solos en el horario y se aplican también al cobrar. Se calcula con la hora de Argentina.">
                <Row title="Activar happy hour" trailing={interruptor(borrador.happyHour.activo, (v) => cambiarHH({ activo: v }), 'Happy hour')} />
                {borrador.happyHour.activo ? (
                  <View style={styles.bloque}>
                    <Text variant="footnote" color="secondary">Días</Text>
                    <View style={styles.chips}>{DIAS.map((d) => <Chip key={d.n} label={d.t} selected={borrador.happyHour.dias.includes(d.n)} onPress={() => cambiarHH({ dias: alternar(borrador.happyHour.dias, d.n) })} />)}</View>
                  </View>
                ) : null}
                {borrador.happyHour.activo ? <Field label="Desde" value={borrador.happyHour.desde} onChangeText={(t) => cambiarHH({ desde: t })} placeholder="18:00" inputMode="numeric" /> : null}
                {borrador.happyHour.activo ? <Field label="Hasta" value={borrador.happyHour.hasta} onChangeText={(t) => cambiarHH({ hasta: t })} placeholder="20:00" inputMode="numeric" /> : null}
                {borrador.happyHour.activo ? <Row title="Descuento" trailing={<Stepper value={borrador.happyHour.descuento} min={5} max={90} onChange={(n) => cambiarHH({ descuento: n })} label="Descuento" />} value={`${borrador.happyHour.descuento} %`} /> : null}
                {borrador.happyHour.activo ? (
                  <View style={styles.bloque}>
                    <Text variant="footnote" color="secondary">{borrador.happyHour.categorias.length ? 'Solo en estas categorías' : 'En toda la carta (tocá para elegir categorías)'}</Text>
                    <View style={styles.chips}>{(categoriasQ.data ?? []).map((c) => <Chip key={c.id} label={c.nombre} selected={borrador.happyHour.categorias.includes(c.id)} onPress={() => cambiarHH({ categorias: alternar(borrador.happyHour.categorias, c.id) })} />)}</View>
                  </View>
                ) : null}
              </Group>

              <Group header="Cobro por transferencia" footer="El cliente ve este alias, el importe exacto y un código. Cuando ves la plata en tu cuenta, confirmás desde Avisos y se emite el comprobante.">
                <Field label="Alias" value={borrador.pago.alias} onChangeText={(t) => cambiar({ pago: { ...borrador.pago, alias: t } })} placeholder="mi.local.mp" autoCapitalize="none" autoCorrect={false} />
                <Field label="Titular" value={borrador.pago.titular} onChangeText={(t) => cambiar({ pago: { ...borrador.pago, titular: t } })} placeholder="Nombre de la cuenta" />
                <Field label="Mensaje" value={borrador.pago.mensaje} onChangeText={(t) => cambiar({ pago: { ...borrador.pago, mensaje: t } })} placeholder="Opcional" />
              </Group>

              <Group header="Reservas por WhatsApp" footer="El asistente de WhatsApp toma reservas con la disponibilidad real de las mesas. Quedan pendientes hasta que las confirmás desde Avisos, y la persona se entera por el mismo chat.">
                <Row title="Tomar reservas" trailing={interruptor(borrador.reservas.activas, (v) => cambiar({ reservas: { ...borrador.reservas, activas: v } }), 'Tomar reservas')} />
                {borrador.reservas.activas ? (
                  <>
                    <Row title="Duración de la mesa" trailing={<Stepper value={borrador.reservas.duracionMin} min={30} max={300} step={15} onChange={(n) => cambiar({ reservas: { ...borrador.reservas, duracionMin: n } })} label="Duración en minutos" />} value={`${borrador.reservas.duracionMin} min`} />
                    <Row title="Máximo de personas" trailing={<Stepper value={borrador.reservas.maxPersonas} min={1} max={60} onChange={(n) => cambiar({ reservas: { ...borrador.reservas, maxPersonas: n } })} label="Máximo de personas" />} value={String(borrador.reservas.maxPersonas)} />
                    <Field label="Desde" value={borrador.reservas.desde} onChangeText={(t) => cambiar({ reservas: { ...borrador.reservas, desde: t } })} placeholder="12:00" />
                    <Field label="Hasta" value={borrador.reservas.hasta} onChangeText={(t) => cambiar({ reservas: { ...borrador.reservas, hasta: t } })} placeholder="23:30" />
                  </>
                ) : null}
              </Group>

              <Group header="Pedidos para llevar por WhatsApp" footer="Entran directo a cocina y se pagan al retirar. Desde Avisos marcás la entrega y el cobro.">
                <Row title="Tomar pedidos para llevar" trailing={interruptor(borrador.llevar.activo, (v) => cambiar({ llevar: { ...borrador.llevar, activo: v } }), 'Pedidos para llevar')} />
                {borrador.llevar.activo ? <Row title="Demora mínima" trailing={<Stepper value={borrador.llevar.demoraMin} min={5} max={240} step={5} onChange={(n) => cambiar({ llevar: { ...borrador.llevar, demoraMin: n } })} label="Demora mínima en minutos" />} value={`${borrador.llevar.demoraMin} min`} /> : null}
              </Group>

              <Group header="Datos fiscales del local" footer="Salen en el ticket y definen qué tipo de factura (A, B o C) le corresponde a cada cliente. La factura en sí la emitís vos en ARCA: acá el cliente la pide y vos dejás el número.">
                <Field label="Razón social" value={borrador.fiscal.razonSocial} onChangeText={(t) => cambiar({ fiscal: { ...borrador.fiscal, razonSocial: t } })} placeholder="Opcional" />
                <Field label="CUIT" value={borrador.fiscal.cuit} onChangeText={(t) => cambiar({ fiscal: { ...borrador.fiscal, cuit: t } })} placeholder="30-12345678-9" keyboardType="number-pad" />
                <Field label="Domicilio" value={borrador.fiscal.domicilio} onChangeText={(t) => cambiar({ fiscal: { ...borrador.fiscal, domicilio: t } })} placeholder="Opcional" />
                <View style={styles.bloque}>
                  <Segmented
                    accessibilityLabel="Condición frente al IVA del local"
                    items={[{ value: 'responsable_inscripto', label: 'Resp. Inscripto' }, { value: 'monotributo', label: 'Monotributo' }, { value: 'exento', label: 'Exento' }]}
                    value={borrador.fiscal.condicionIva}
                    onChange={(v) => cambiar({ fiscal: { ...borrador.fiscal, condicionIva: v } })}
                  />
                </View>
                <Row title="Dejar que pidan factura" subtitle="Aparece el botón en el comprobante del cliente" trailing={interruptor(borrador.fiscal.pedirFactura, (v) => cambiar({ fiscal: { ...borrador.fiscal, pedirFactura: v } }), 'Permitir pedidos de factura')} />
              </Group>

              <Group header="Propina sugerida">
                <View style={styles.chips}>{PROPINAS.map((p) => <Chip key={p} label={p === 0 ? 'Sin propina' : `${p} %`} selected={borrador.propinas.includes(p)} onPress={() => cambiar({ propinas: alternar(borrador.propinas, p).sort((a, b) => a - b).slice(0, 4) })} />)}</View>
              </Group>

              <Group header="Conexiones" footer="Mercado Pago y la IA gratuita se activan cargando sus claves en el servidor (ver documentación). Sin claves todo funciona igual: el asistente usa el motor propio y se cobra por transferencia.">
                <Row title="Mercado Pago" value={ajustesQ.data?.integraciones.mercadopago ? 'Conectado' : 'Sin credenciales'} />
                <Row title="Asistente" value={ajustesQ.data?.integraciones.ia ? `IA: ${ajustesQ.data.integraciones.ia}` : 'Motor propio'} />
              </Group>

              <Group header="Opiniones">
                <Row title="Reseñas de los clientes" leading={<Star size={20} color={colors.tint} />} chevron onPress={() => setVerResenas(true)} />
              </Group>

              {guardar.isError ? <ErrorBanner message={guardar.error instanceof Error ? guardar.error.message : 'No se pudo guardar'} /> : null}
            </>
          )}
        </View>
      </ScrollView>

      {sucio ? (
        <View style={[styles.guardar, { bottom: insets.bottom + space.lg }]} pointerEvents="box-none">
          <Button label="Guardar ajustes" size="lg" loading={guardar.isPending} onPress={() => guardar.mutate()} style={styles.botonGuardar} />
        </View>
      ) : null}
      <Resenas open={verResenas} onClose={() => setVerResenas(false)} />
      <Toast message={aviso} onHide={() => setAviso(null)} />
    </View>
  );
}

function Resenas({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['resenas'], queryFn: obtenerResenas, enabled: open });
  return (
    <Sheet open={open} onClose={onClose} title="Reseñas">
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.lg }} showsVerticalScrollIndicator={false}>
        {!q.data ? <ActivityIndicator color={colors.tint} /> : q.data.total === 0 ? (
          <Text variant="callout" color="secondary" align="center">Todavía no hay reseñas. Aparecen cuando los clientes pagan desde el QR.</Text>
        ) : (
          <>
            <Text variant="title1" align="center" numeric>{`${q.data.promedio?.toFixed(1)} ★`}</Text>
            <Text variant="footnote" color="secondary" align="center">{`${q.data.total} ${q.data.total === 1 ? 'opinión' : 'opiniones'}`}</Text>
            {q.data.resenas.map((r, i) => (
              <View key={i} style={[styles.resena, { backgroundColor: colors.surface }]}>
                <Text variant="headline">{'★'.repeat(r.estrellas)}{'☆'.repeat(5 - r.estrellas)}{r.mesa ? `  ·  Mesa ${r.mesa}` : ''}</Text>
                {r.comentario ? <Text variant="callout">{r.comentario}</Text> : null}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  contenido: { paddingHorizontal: space.xl, alignItems: 'center' },
  ancho: { width: '100%', maxWidth: 720, gap: space.xl },
  volver: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, marginLeft: -space.sm, paddingRight: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.lg },
  bloque: { padding: space.lg, gap: space.sm },
  guardar: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  botonGuardar: { paddingHorizontal: space['4xl'], boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
  resena: { padding: space.lg, borderRadius: radius.lg, gap: space.xs },
});
