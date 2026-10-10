import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCodeSvg from 'react-native-qrcode-svg';
import { CheckCircle2, FileText, Printer, Star } from 'lucide-react-native';
import { enviarResena, obtenerComprobante, obtenerTicket, type Idioma } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Button, ErrorBanner, PressableScale, Text, fontFor, haptic, radius, space, useTheme } from '@vase/ui';
import { localeDe, type Textos } from '@/lib/i18n';
import { textosFactura } from '@/lib/i18nFactura';
import { imprimir } from '@/lib/carta';
import { htmlTicket } from '@/lib/ticket';
import { FacturaSheet } from './FacturaSheet';

/** Dirección que abre el control de salida: el QR del comprobante lleva directo al verificador del personal. */
export function enlaceDeSalida(codigo: string): string {
  const origen = globalThis.location?.origin ?? '';
  return `${origen}/salida?c=${encodeURIComponent(codigo)}`;
}

/** Comprobante de pago: código y QR para mostrar al salir, y la reseña. */
export function ComprobanteVista({ codigo, textos, idioma }: { codigo: string; textos: Textos; idioma: Idioma }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['comprobante', codigo], queryFn: () => obtenerComprobante(codigo) });
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviada, setEnviada] = useState(false);
  const [verFactura, setVerFactura] = useState(false);
  const tf = textosFactura(idioma);
  const ticketQ = useQuery({ queryKey: ['ticket', codigo], queryFn: () => obtenerTicket(codigo), refetchInterval: 20000 });
  const imprimirTicket = useMutation({ mutationFn: async () => imprimir(htmlTicket(await obtenerTicket(codigo))) });
  const resena = useMutation({
    mutationFn: () => enviarResena(codigo, estrellas, comentario),
    onSuccess: () => { setEnviada(true); haptic.exito(); void queryClient.invalidateQueries({ queryKey: ['comprobante', codigo] }); },
  });
  const c = q.data;
  if (!c) return null;
  const hora = c.pagadoEn ? new Date(c.pagadoEn).toLocaleString(localeDe(idioma), { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <View style={styles.pila}>
      <View style={styles.titulo}>
        <CheckCircle2 size={44} color={colors.tint} strokeWidth={2} />
        <Text variant="title2" align="center">{textos.pagoConfirmado}</Text>
        <Text variant="callout" color="secondary" align="center">{textos.mostraEnLaSalida}</Text>
      </View>

      <View style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
        <View style={styles.qr}><QRCodeSvg value={enlaceDeSalida(c.codigo)} size={176} color="#1C1C1E" backgroundColor="#FFFFFF" /></View>
        <Text variant="footnote" color="secondary">{textos.codigo}</Text>
        <Text variant="title1" weight="700" numeric style={styles.codigo} accessibilityLabel={`${textos.codigo} ${c.codigo}`}>{c.codigo}</Text>
        <View style={[styles.linea, { borderTopColor: colors.separator }]}>
          {c.mesa ? <Fila k={textos.mesa(c.mesa)} v={c.local} /> : null}
          <Fila k={textos.importe} v={formatearARS(c.monto, true)} />
          {c.propina > 0 ? <Fila k={textos.propina} v={formatearARS(c.propina, true)} /> : null}
          <Fila k={textos.total} v={formatearARS(c.total, true)} fuerte />
          {hora ? <Fila k={textos.pagadoEl} v={hora} /> : null}
        </View>
      </View>
      <Text variant="footnote" color="secondary" align="center">{textos.noEsFactura}</Text>

      <View style={styles.acciones}>
        <Button label={tf.imprimirTicket} variant="tinted" icon={<Printer size={18} color={colors.tint} />} loading={imprimirTicket.isPending} onPress={() => imprimirTicket.mutate()} full />
        {ticketQ.data?.puedePedirFactura && (!ticketQ.data.factura || ticketQ.data.factura.estado === 'rechazada') ? (
          <Button label={ticketQ.data.factura ? tf.volverAPedir : tf.pedirFactura} variant="tinted" icon={<FileText size={18} color={colors.tint} />} onPress={() => setVerFactura(true)} full />
        ) : null}
      </View>
      {imprimirTicket.isError ? <ErrorBanner message={imprimirTicket.error instanceof Error ? imprimirTicket.error.message : textos.error} /> : null}
      {ticketQ.data?.factura ? (
        <View style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
          <Text variant="callout" align="center">
            {ticketQ.data.factura.estado === 'pendiente' ? tf.pendiente : ticketQ.data.factura.estado === 'emitida' ? tf.emitida(ticketQ.data.factura.tipo, ticketQ.data.factura.numero ?? '') : `${tf.rechazada} ${ticketQ.data.factura.motivo}`}
          </Text>
        </View>
      ) : null}
      <FacturaSheet open={verFactura} onClose={() => setVerFactura(false)} codigo={codigo} idioma={idioma} condicionEmisor={ticketQ.data?.condicionEmisor ?? 'responsable_inscripto'} />

      {c.reseniaEnviada || enviada ? (
        <Text variant="callout" weight="600" color="tint" align="center">{textos.gracias}</Text>
      ) : (
        <View style={[styles.tarjeta, { backgroundColor: colors.surface, gap: space.md }]}>
          <Text variant="headline" align="center">{textos.comoEstuvo}</Text>
          <View style={styles.estrellas}>
            {[1, 2, 3, 4, 5].map((n) => (
              <PressableScale key={n} onPress={() => { haptic.seleccion(); setEstrellas(n); }} accessibilityLabel={`${n}`} accessibilityState={{ selected: estrellas >= n }} style={styles.estrella}>
                <Star size={34} color={estrellas >= n ? '#F5A623' : colors.labelTertiary} fill={estrellas >= n ? '#F5A623' : 'transparent'} strokeWidth={1.8} />
              </PressableScale>
            ))}
          </View>
          {estrellas > 0 ? (
            <>
              <TextInput value={comentario} onChangeText={setComentario} placeholder={textos.comentarioOpcional} placeholderTextColor={colors.labelTertiary} selectionColor={colors.tint} multiline maxLength={500} accessibilityLabel={textos.comentarioOpcional} style={[styles.comentario, fontFor('400'), { backgroundColor: colors.fillSoft, color: colors.label }]} />
              {resena.isError ? <ErrorBanner message={resena.error instanceof Error ? resena.error.message : textos.error} /> : null}
              <Button label={textos.enviar} loading={resena.isPending} onPress={() => resena.mutate()} full />
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Fila({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <View style={styles.fila}>
      <Text variant={fuerte ? 'headline' : 'callout'} color={fuerte ? 'label' : 'secondary'}>{k}</Text>
      <Text variant={fuerte ? 'headline' : 'callout'} numeric weight={fuerte ? '700' : '500'} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.xl },
  titulo: { alignItems: 'center', gap: space.sm },
  acciones: { gap: space.sm },
  tarjeta: { padding: space.xl, borderRadius: radius.xl, alignItems: 'center', gap: space.xs, borderCurve: 'continuous' },
  qr: { padding: space.md, backgroundColor: '#FFFFFF', borderRadius: radius.md, marginBottom: space.md },
  codigo: { letterSpacing: 2 },
  linea: { alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.lg, paddingTop: space.lg, gap: space.sm },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  estrellas: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
  estrella: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  comentario: { alignSelf: 'stretch', minHeight: 72, fontSize: 16, padding: space.md, borderRadius: radius.md, textAlignVertical: 'top', outlineStyle: 'none' as never },
});
