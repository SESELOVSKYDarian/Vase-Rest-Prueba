import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarClock, Check, Copy, FileText, Landmark, Receipt, ShoppingBag, X } from 'lucide-react-native';
import { aceptarSolicitud, confirmarPagoQr, confirmarReserva, entregarPedidoLlevar, marcarFacturaEmitida, rechazarPagoQr, rechazarPedidoFactura, rechazarPedidoLlevar, rechazarReserva, rechazarSolicitud, type Avisos, type FacturaPendiente, type PedidoLlevar, type ReservaPendiente } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Button, EmptyState, ErrorBanner, Sheet, Text, fontFor, haptic, radius, space, useTheme } from '@vase/ui';

interface Props { open: boolean; onClose: () => void; avisos: Avisos | undefined; onAviso: (mensaje: string) => void }

const hace = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 1 ? 'recién' : min < 60 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
};

/** Lo que pide el salón: pedidos y llamados que llegan desde el QR, y transferencias por confirmar. */
export function AvisosSheet({ open, onClose, avisos, onAviso }: Props) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const refrescar = () => Promise.all(['avisos', 'pedidos', 'mesas'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

  const aceptar = useMutation({
    mutationFn: aceptarSolicitud,
    onSuccess: async (r) => { haptic.exito(); onAviso(r.omitidos.length ? `Faltó agregar ${r.omitidos.length}: ${r.omitidos[0].motivo}` : 'Pedido confirmado: ya está en cocina'); await refrescar(); },
    onError: () => haptic.error(),
  });
  const rechazar = useMutation({ mutationFn: rechazarSolicitud, onSuccess: async () => { haptic.medio(); await refrescar(); } });
  const confirmar = useMutation({
    mutationFn: confirmarPagoQr,
    onSuccess: async (r) => { haptic.exito(); onAviso(r.cerrado ? 'Pago confirmado: la cuenta quedó saldada y la mesa libre' : 'Pago confirmado'); await refrescar(); },
    onError: () => haptic.error(),
  });
  const noLlego = useMutation({ mutationFn: rechazarPagoQr, onSuccess: async () => { haptic.medio(); await refrescar(); } });

  const emitir = useMutation({
    mutationFn: ({ id, numero }: { id: string; numero: string }) => marcarFacturaEmitida(id, numero),
    onSuccess: async () => { haptic.exito(); onAviso('Factura registrada: el cliente ya la ve en su comprobante'); await refrescar(); },
    onError: () => haptic.error(),
  });
  const noEmitir = useMutation({ mutationFn: ({ id, motivo }: { id: string; motivo: string }) => rechazarPedidoFactura(id, motivo), onSuccess: async () => { haptic.medio(); await refrescar(); } });

  const confirmaReserva = useMutation({ mutationFn: confirmarReserva, onSuccess: async () => { haptic.exito(); onAviso('Reserva confirmada: le avisamos por WhatsApp'); await refrescar(); }, onError: () => haptic.error() });
  const rechazaReserva = useMutation({ mutationFn: (id: string) => rechazarReserva(id, ''), onSuccess: async () => { haptic.medio(); await refrescar(); } });
  const entrega = useMutation({
    mutationFn: ({ id, metodo }: { id: string; metodo: 'efectivo' | 'billetera_virtual' }) => entregarPedidoLlevar(id, metodo),
    onSuccess: async () => { haptic.exito(); onAviso('Pedido entregado y cobrado'); await refrescar(); },
    onError: () => haptic.error(),
  });
  const rechazaLlevar = useMutation({ mutationFn: rechazarPedidoLlevar, onSuccess: async () => { haptic.medio(); await refrescar(); } });

  const error = [aceptar, rechazar, confirmar, noLlego, emitir, noEmitir, confirmaReserva, rechazaReserva, entrega, rechazaLlevar].find((m) => m.isError)?.error;
  const vacio = !avisos || (avisos.solicitudes.length === 0 && avisos.pagos.length === 0 && avisos.facturas.length === 0 && avisos.reservas.length === 0 && avisos.llevar.length === 0);

  return (
    <Sheet open={open} onClose={onClose} title="Avisos de las mesas">
      <ScrollView contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
        {error ? <ErrorBanner message={error instanceof Error ? error.message : 'No se pudo completar'} /> : null}
        {vacio ? <EmptyState icon={<BellRing size={30} color={colors.labelSecondary} />} title="Todo al día" message="Cuando una mesa pida o llame desde el QR, aparece acá." /> : null}

        {avisos && (avisos.solicitudes.length || avisos.pagos.length) ? <Encabezado texto="En las mesas" /> : null}
        {avisos?.solicitudes.map((s) => (
          <View key={s.id} style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
            <View style={styles.cabecera}>
              {s.tipo === 'pedido' ? <Receipt size={20} color={colors.tint} /> : <BellRing size={20} color={colors.tint} />}
              <View style={{ flex: 1 }}>
                <Text variant="headline">{s.tipo === 'pedido' ? `Mesa ${s.mesa} quiere pedir` : s.tipo === 'mozo' ? `Mesa ${s.mesa} llama al mozo` : `Mesa ${s.mesa} pide la cuenta`}</Text>
                <Text variant="footnote" color="secondary">{hace(s.creadaEn)}</Text>
              </View>
            </View>
            {s.items.map((i, k) => (
              <Text key={k} variant="callout">{`${i.cantidad} × ${i.nombre}`}{i.notas ? <Text variant="callout" color="secondary">{`  ·  ${i.notas}`}</Text> : null}</Text>
            ))}
            {s.nota ? <Text variant="callout" color="secondary">{s.nota}</Text> : null}
            <View style={styles.botones}>
              <Button label={s.tipo === 'pedido' ? 'Confirmar y enviar a cocina' : 'Listo, ya voy'} size="sm" icon={<Check size={16} color={colors.onTint} />} loading={aceptar.isPending && aceptar.variables === s.id} onPress={() => aceptar.mutate(s.id)} style={{ flexGrow: 1, flexBasis: 150 }} />
              {s.tipo === 'pedido' ? <Button label="Rechazar" size="sm" variant="plain" loading={rechazar.isPending && rechazar.variables === s.id} onPress={() => rechazar.mutate(s.id)} /> : null}
            </View>
          </View>
        ))}

        {avisos?.pagos.map((p) => (
          <View key={p.id} style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
            <View style={styles.cabecera}>
              <Landmark size={20} color={colors.tint} />
              <View style={{ flex: 1 }}>
                <Text variant="headline">{`Transferencia de la mesa ${p.mesa ?? '?'}`}</Text>
                <Text variant="footnote" color="secondary">{`${hace(p.creadoEn)} · código ${p.codigo}`}</Text>
              </View>
              <Text variant="title3" numeric weight="700">{formatearARS(p.total, true)}</Text>
            </View>
            <Text variant="footnote" color="secondary">Confirmá solo si ya ves esta plata (y el código en el concepto) en tu cuenta o billetera.</Text>
            <View style={styles.botones}>
              <Button label="Llegó" size="sm" icon={<Check size={16} color={colors.onTint} />} loading={confirmar.isPending && confirmar.variables === p.id} onPress={() => confirmar.mutate(p.id)} style={{ flexGrow: 1, flexBasis: 150 }} />
              <Button label="No llegó" size="sm" variant="plain" icon={<X size={16} color={colors.tint} />} loading={noLlego.isPending && noLlego.variables === p.id} onPress={() => noLlego.mutate(p.id)} />
            </View>
          </View>
        ))}

        {avisos && avisos.reservas.length ? <Encabezado texto="Reservas por confirmar" /> : null}
        {avisos?.reservas.map((r) => (
          <TarjetaReserva key={r.id} r={r} ocupada={(confirmaReserva.isPending && confirmaReserva.variables === r.id) || (rechazaReserva.isPending && rechazaReserva.variables === r.id)} onConfirmar={() => confirmaReserva.mutate(r.id)} onRechazar={() => rechazaReserva.mutate(r.id)} />
        ))}

        {avisos && avisos.llevar.length ? <Encabezado texto="Pedidos para llevar" /> : null}
        {avisos?.llevar.map((p) => (
          <TarjetaLlevar key={p.id} p={p} ocupada={(entrega.isPending && entrega.variables?.id === p.id) || (rechazaLlevar.isPending && rechazaLlevar.variables === p.id)} onEntregar={(metodo) => entrega.mutate({ id: p.id, metodo })} onRechazar={() => rechazaLlevar.mutate(p.id)} />
        ))}

        {avisos && avisos.facturas.length ? <Encabezado texto="Facturas para emitir" /> : null}
        {avisos?.facturas.map((f) => (
          <TarjetaFactura key={f.id} f={f} ocupada={(emitir.isPending && emitir.variables?.id === f.id) || (noEmitir.isPending && noEmitir.variables?.id === f.id)} onEmitida={(numero) => emitir.mutate({ id: f.id, numero })} onRechazar={(motivo) => noEmitir.mutate({ id: f.id, motivo })} />
        ))}
      </ScrollView>
    </Sheet>
  );
}

const ZONA = 'America/Argentina/Buenos_Aires';
function Encabezado({ texto }: { texto: string }) {
  return <Text variant="subhead" weight="600" color="secondary" accessibilityRole="header" style={{ marginTop: space.sm, paddingHorizontal: space.xs }}>{texto}</Text>;
}

const horaCorta = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }) : '');
// El local trabaja en hora argentina, sin importar la zona del celular o la PC.
const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA });
const cuando = (iso: string) => {
  const d = new Date(iso);
  const hoy = new Date();
  const dia = ymd(d) === ymd(hoy) ? 'Hoy' : ymd(d) === ymd(new Date(hoy.getTime() + 86400000)) ? 'Mañana' : d.toLocaleDateString('es-AR', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'numeric' });
  return `${dia} ${horaCorta(iso)}`;
};

/** Reserva que pidió alguien por WhatsApp: el local la confirma (o la rechaza) y la persona se entera por el chat. */
function TarjetaReserva({ r, ocupada, onConfirmar, onRechazar }: { r: ReservaPendiente; ocupada: boolean; onConfirmar: () => void; onRechazar: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
      <View style={styles.cabecera}>
        <CalendarClock size={20} color={colors.tint} />
        <View style={{ flex: 1 }}>
          <Text variant="headline">{`Reserva · ${cuando(r.inicio)}`}</Text>
          <Text variant="footnote" color="secondary">{`${r.nombre} · ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}${r.mesa ? ` · mesa ${r.mesa}` : ''}${r.origen === 'whatsapp' ? ' · WhatsApp' : ''}`}</Text>
        </View>
      </View>
      <Text variant="footnote" color="secondary">{`${r.telefono} · pedida ${hace(r.creadaEn)}`}</Text>
      <View style={styles.botones}>
        <Button label="Confirmar" size="sm" icon={<Check size={16} color={colors.onTint} />} loading={ocupada} onPress={onConfirmar} style={{ flexGrow: 1, flexBasis: 150 }} />
        <Button label="Rechazar" size="sm" variant="plain" onPress={onRechazar} />
      </View>
    </View>
  );
}

const ESTADO_LLEVAR: Record<string, string> = { pendiente: 'En cocina', preparando: 'Preparando', en_preparacion: 'Preparando', listo: 'Listo para retirar', entregado: 'Entregado' };

/** Pedido para llevar: cocina lo prepara; acá se entrega y se cobra al retirar. */
function TarjetaLlevar({ p, ocupada, onEntregar, onRechazar }: { p: PedidoLlevar; ocupada: boolean; onEntregar: (metodo: 'efectivo' | 'billetera_virtual') => void; onRechazar: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
      <View style={styles.cabecera}>
        <ShoppingBag size={20} color={colors.tint} />
        <View style={{ flex: 1 }}>
          <Text variant="headline">{`Para llevar #${p.codigo}${p.retiro ? ` · retira ${horaCorta(p.retiro)}` : ''}`}</Text>
          <Text variant="footnote" color="secondary">{`${p.cliente} · ${ESTADO_LLEVAR[p.estado] ?? p.estado}`}</Text>
        </View>
        <Text variant="title3" numeric weight="700">{formatearARS(p.total, true)}</Text>
      </View>
      {p.items.map((i, k) => <Text key={k} variant="callout">{`${i.cantidad} × ${i.nombre}`}{i.notas ? <Text variant="callout" color="secondary">{`  ·  ${i.notas}`}</Text> : null}</Text>)}
      <Text variant="footnote" color="secondary">Al entregarlo, ¿cómo pagó?</Text>
      <View style={styles.botones}>
        <Button label="Efectivo" size="sm" icon={<Check size={16} color={colors.onTint} />} loading={ocupada} onPress={() => onEntregar('efectivo')} style={{ flexGrow: 1, flexBasis: 120 }} />
        <Button label="Transferencia" size="sm" variant="tinted" onPress={() => onEntregar('billetera_virtual')} />
        {p.estado === 'pendiente' ? <Button label="Rechazar" size="sm" variant="plain" onPress={onRechazar} /> : null}
      </View>
    </View>
  );
}

const CONDICION: Record<string, string> = { consumidor_final: 'Consumidor final', responsable_inscripto: 'Resp. Inscripto', monotributo: 'Monotributo', exento: 'Exento' };

/** Pedido de factura: se copian los datos, se emite en ARCA y acá se anota el número real que salió. */
function TarjetaFactura({ f, ocupada, onEmitida, onRechazar }: { f: FacturaPendiente; ocupada: boolean; onEmitida: (numero: string) => void; onRechazar: (motivo: string) => void }) {
  const { colors } = useTheme();
  const [numero, setNumero] = useState('');
  const [copiado, setCopiado] = useState(false);
  const datos = `${f.nombre}\n${f.docTipo} ${f.docNumero}\n${CONDICION[f.condicionIva] ?? f.condicionIva}${f.domicilio ? `\n${f.domicilio}` : ''}\n${f.email}\nFactura ${f.tipo} · ${formatearARS(f.importeNeto, true)}`;
  const copiar = async () => {
    try { await globalThis.navigator?.clipboard?.writeText(datos); setCopiado(true); haptic.seleccion(); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles: se copia a mano */ }
  };
  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
      <View style={styles.cabecera}>
        <FileText size={20} color={colors.tint} />
        <View style={{ flex: 1 }}>
          <Text variant="headline">{`Factura ${f.tipo} · mesa ${f.mesa ?? '?'}`}</Text>
          <Text variant="footnote" color="secondary">{`${hace(f.creadaEn)} · código ${f.codigo}`}</Text>
        </View>
        <Text variant="title3" numeric weight="700">{formatearARS(f.importeNeto, true)}</Text>
      </View>
      <Text variant="callout">{f.nombre}</Text>
      <Text variant="callout" color="secondary">{`${f.docTipo} ${f.docNumero} · ${CONDICION[f.condicionIva] ?? f.condicionIva}`}</Text>
      <Text variant="callout" color="secondary">{f.email}{f.domicilio ? ` · ${f.domicilio}` : ''}</Text>
      <Button label={copiado ? 'Copiado' : 'Copiar datos'} size="sm" variant="tinted" icon={<Copy size={16} color={colors.tint} />} onPress={copiar} />
      <Text variant="footnote" color="secondary">Emitila en ARCA con estos datos y anotá acá el número que te dio. Sin número no se marca como emitida.</Text>
      <TextInput
        value={numero}
        onChangeText={(t) => setNumero(t.replace(/[^\d-]/g, ''))}
        placeholder="Número de factura (0001-00000123)"
        placeholderTextColor={colors.labelTertiary}
        selectionColor={colors.tint}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel="Número de factura emitida"
        style={[styles.numero, fontFor('500'), { backgroundColor: colors.fillSoft, color: colors.label }]}
      />
      <View style={styles.botones}>
        <Button label="Ya la emití" size="sm" icon={<Check size={16} color={colors.onTint} />} disabled={!/^\d{1,5}-\d{1,8}$/.test(numero)} loading={ocupada} onPress={() => onEmitida(numero)} style={{ flexGrow: 1, flexBasis: 150 }} />
        <Button label="No se puede" size="sm" variant="plain" onPress={() => onRechazar('Revisá tus datos y volvé a pedirla, o consultá en caja.')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  numero: { fontSize: 16, padding: space.md, borderRadius: radius.md, outlineStyle: 'none' as never },
  cuerpo: { gap: space.md, paddingBottom: space.lg },
  tarjeta: { padding: space.lg, borderRadius: radius.lg, gap: space.sm, borderCurve: 'continuous' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  botones: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.xs },
});
