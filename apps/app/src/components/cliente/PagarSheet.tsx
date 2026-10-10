import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, CreditCard, Landmark } from 'lucide-react-native';
import { cancelarPago, iniciarPago, obtenerComprobante, type Idioma, type MesaQr, type ModoDivision, type PagoIniciado } from '@vase/api';
import { formatearARS, parsearPesos } from '@vase/domain';
import { Button, Chip, ErrorBanner, PressableScale, Sheet, Stepper, Text, fontFor, haptic, radius, space, useTheme } from '@vase/ui';
import { guardarComprobante } from '@/lib/cliente';
import type { Textos } from '@/lib/i18n';
import { ComprobanteVista } from './ComprobanteVista';

interface Props {
  open: boolean;
  onClose: () => void;
  mesa: MesaQr;
  textos: Textos;
  idioma: Idioma;
  /** Para volver directo a un pago en curso o a un comprobante (por ejemplo al volver de Mercado Pago). */
  codigoInicial?: string | null;
}

/** Pagar desde el celular: elegir cómo dividir, la propina y el medio; después esperar la confirmación del local. */
export function PagarSheet({ open, onClose, mesa, textos, idioma, codigoInicial }: Props) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const cuenta = mesa.cuenta;
  const [modo, setModo] = useState<ModoDivision>('todo');
  const [partes, setPartes] = useState(2);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [monto, setMonto] = useState('');
  const [propina, setPropina] = useState(mesa.propinas[0] ?? 0);
  const [metodo, setMetodo] = useState<'transferencia' | 'mercadopago'>(mesa.pago.transferencia ? 'transferencia' : 'mercadopago');
  const [codigo, setCodigo] = useState<string | null>(codigoInicial ?? null);
  const [iniciado, setIniciado] = useState<PagoIniciado | null>(null);
  const [pagado, setPagado] = useState(false);

  useEffect(() => { if (codigoInicial) setCodigo(codigoInicial); }, [codigoInicial]);
  useEffect(() => { if (open && !codigoInicial) { setCodigo(null); setIniciado(null); setElegidas([]); setPagado(false); } }, [open, codigoInicial]);

  const libres = useMemo(() => cuenta?.unidades.filter((u) => !u.cubierta) ?? [], [cuenta]);
  const pendiente = cuenta?.pendiente ?? 0;
  const base = useMemo(() => {
    if (!cuenta) return 0;
    if (modo === 'todo') return pendiente;
    if (modo === 'partes') return Math.min(pendiente, Math.round(cuenta.total / partes));
    if (modo === 'unidades') return elegidas.length && elegidas.length === libres.length ? pendiente : Math.min(pendiente, libres.filter((u) => elegidas.includes(u.clave)).reduce((s, u) => s + u.importe, 0));
    return Math.min(pendiente, parsearPesos(monto) ?? 0);
  }, [cuenta, modo, partes, elegidas, libres, monto, pendiente]);
  const extra = Math.round((base * propina) / 100);

  const iniciar = useMutation({
    mutationFn: () => iniciarPago(mesa.mesa.numero, {
      modo, propina, metodo,
      ...(modo === 'partes' ? { partes } : {}),
      ...(modo === 'unidades' ? { unidades: elegidas } : {}),
      ...(modo === 'monto' ? { monto: (parsearPesos(monto) ?? 0) / 100 } : {}),
    }),
    onSuccess: (p) => {
      haptic.exito();
      setIniciado(p);
      setCodigo(p.codigo);
      guardarComprobante(mesa.mesa.numero, p.codigo);
      void queryClient.invalidateQueries({ queryKey: ['mesa-qr'] });
      if (p.metodo === 'mercadopago' && p.link) void Linking.openURL(p.link);
    },
    onError: () => haptic.error(),
  });

  const puedePagar = base >= 100 && (metodo === 'transferencia' ? mesa.pago.transferencia : mesa.pago.mercadopago);
  const opciones: Array<{ modo: ModoDivision; etiqueta: string }> = [
    { modo: 'todo', etiqueta: textos.divTodo },
    { modo: 'partes', etiqueta: textos.divPartes },
    { modo: 'unidades', etiqueta: textos.divUnidades },
    { modo: 'monto', etiqueta: textos.divMonto },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pagado ? textos.comprobante : textos.pagar}
      footer={!codigo && cuenta ? <Button label={textos.pagarImporte(formatearARS(base + extra, true))} size="lg" full disabled={!puedePagar} loading={iniciar.isPending} onPress={() => iniciar.mutate()} /> : undefined}
    >
      <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {codigo ? (
          <SeguimientoPago codigo={codigo} inicial={iniciado} textos={textos} idioma={idioma} onPagado={() => setPagado(true)} onCancelado={() => { setCodigo(null); setIniciado(null); void queryClient.invalidateQueries({ queryKey: ['mesa-qr'] }); }} />
        ) : cuenta ? (
          <>
            <Text variant="headline">{textos.comoDividir}</Text>
            <View style={styles.chips}>
              {opciones.map((o) => <Chip key={o.modo} label={o.etiqueta} selected={modo === o.modo} onPress={() => setModo(o.modo)} />)}
            </View>

            {modo === 'partes' ? (
              <View style={[styles.caja, { backgroundColor: colors.surface }]}>
                <View style={styles.filaCaja}>
                  <Text variant="body">{textos.entreCuantos}</Text>
                  <Stepper value={partes} min={2} max={12} onChange={setPartes} label={textos.entreCuantos} />
                </View>
              </View>
            ) : null}

            {modo === 'unidades' ? (
              <View style={[styles.caja, { backgroundColor: colors.surface }]}>
                <Text variant="footnote" color="secondary" style={{ padding: space.lg, paddingBottom: space.sm }}>{textos.elegiPlatos}</Text>
                {libres.map((u) => {
                  const on = elegidas.includes(u.clave);
                  return (
                    <PressableScale key={u.clave} onPress={() => { haptic.seleccion(); setElegidas(on ? elegidas.filter((c) => c !== u.clave) : [...elegidas, u.clave]); }} accessibilityLabel={`${u.nombre} ${formatearARS(u.importe, true)}`} accessibilityState={{ selected: on }} style={styles.unidad}>
                      <View style={[styles.check, { borderColor: on ? colors.tint : colors.labelTertiary, backgroundColor: on ? colors.tint : 'transparent' }]}>{on ? <Check size={14} color={colors.onTint} strokeWidth={3} /> : null}</View>
                      <Text variant="body" style={{ flex: 1 }} numberOfLines={2}>{u.nombre}</Text>
                      <Text variant="body" numeric color="secondary">{formatearARS(u.importe, true)}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}

            {modo === 'monto' ? (
              <View style={[styles.caja, { backgroundColor: colors.surface }]}>
                <View style={styles.filaCaja}>
                  <Text variant="body">{textos.importeLibre}</Text>
                  <TextInput value={monto} onChangeText={setMonto} keyboardType="decimal-pad" inputMode="decimal" placeholder="0" placeholderTextColor={colors.labelTertiary} selectionColor={colors.tint} accessibilityLabel={textos.importeLibre} style={[styles.importe, fontFor('600'), { color: colors.label }]} />
                </View>
              </View>
            ) : null}

            <Text variant="headline">{textos.propina}</Text>
            <View style={styles.chips}>
              {mesa.propinas.map((p) => <Chip key={p} label={p === 0 ? textos.sinPropina : `${p} %`} selected={propina === p} onPress={() => setPropina(p)} />)}
            </View>

            <Text variant="headline">{textos.medioDePago}</Text>
            <View style={{ gap: space.sm }}>
              {mesa.pago.transferencia ? <Metodo icono={<Landmark size={22} color={colors.tint} />} titulo={textos.transferencia} detalle={textos.transferenciaAyuda} activo={metodo === 'transferencia'} onPress={() => setMetodo('transferencia')} /> : null}
              {mesa.pago.mercadopago ? <Metodo icono={<CreditCard size={22} color={colors.tint} />} titulo={textos.mercadoPago} detalle={textos.mercadoPagoAyuda} activo={metodo === 'mercadopago'} onPress={() => setMetodo('mercadopago')} /> : null}
              {!mesa.pago.transferencia && !mesa.pago.mercadopago ? <Text variant="callout" color="secondary">{textos.pedirCuenta}</Text> : null}
            </View>

            <View style={[styles.resumen, { backgroundColor: colors.surface }]}>
              <Fila k={textos.importe} v={formatearARS(base, true)} />
              {propina > 0 ? <Fila k={`${textos.propina} ${propina} %`} v={formatearARS(extra, true)} /> : null}
              <Fila k={textos.total} v={formatearARS(base + extra, true)} fuerte />
            </View>
            {iniciar.isError ? <ErrorBanner message={iniciar.error instanceof Error ? iniciar.error.message : textos.error} /> : null}
          </>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function SeguimientoPago({ codigo, inicial, textos, idioma, onPagado, onCancelado }: { codigo: string; inicial: PagoIniciado | null; textos: Textos; idioma: Idioma; onPagado: () => void; onCancelado: () => void }) {
  const { colors } = useTheme();
  const [copiado, setCopiado] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['pago', codigo],
    queryFn: () => obtenerComprobante(codigo),
    refetchInterval: (consulta) => (consulta.state.data && consulta.state.data.estado !== 'pendiente' ? false : 3000),
  });
  const cancelar = useMutation({ mutationFn: () => cancelarPago(codigo), onSuccess: onCancelado });
  const c = q.data;
  useEffect(() => { if (c?.estado === 'pagado') onPagado(); }, [c?.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <View style={styles.centro}><ActivityIndicator color={colors.tint} /></View>;
  if (c.estado === 'pagado') return <ComprobanteVista codigo={codigo} textos={textos} idioma={idioma} />;
  if (c.estado === 'vencido' || c.estado === 'rechazado') {
    return (
      <View style={styles.centro}>
        <Text variant="callout" color="secondary" align="center">{c.estado === 'vencido' ? textos.pagoVencido : textos.pagoRechazado}</Text>
        <Button label={textos.volverALaCuenta} variant="tinted" onPress={onCancelado} />
      </View>
    );
  }

  const transferencia = c.transferencia ?? inicial?.transferencia;
  const link = c.link ?? inicial?.link;
  const copiar = async (clave: string, valor: string) => {
    try { await globalThis.navigator?.clipboard?.writeText(valor); setCopiado(clave); haptic.ligero(); setTimeout(() => setCopiado(null), 1600); } catch { /* sin portapapeles */ }
  };

  return (
    <View style={styles.pila}>
      {c.metodo === 'transferencia' && transferencia ? (
        <View style={[styles.caja, { backgroundColor: colors.surface }]}>
          <Text variant="headline" style={{ padding: space.lg, paddingBottom: space.xs }}>{textos.transferiAEsteAlias}</Text>
          <Dato k={textos.alias} v={transferencia.alias} grande onCopiar={() => copiar('alias', transferencia.alias)} copiado={copiado === 'alias'} textos={textos} />
          {transferencia.titular ? <Dato k={textos.titular} v={transferencia.titular} /> : null}
          <Dato k={textos.importeExacto} v={formatearARS(c.total, true)} grande onCopiar={() => copiar('importe', (c.total / 100).toFixed(2).replace('.', ','))} copiado={copiado === 'importe'} textos={textos} />
          <Dato k={textos.conceptoCodigo} v={c.codigo} onCopiar={() => copiar('codigo', c.codigo)} copiado={copiado === 'codigo'} textos={textos} />
          {transferencia.mensaje ? <Text variant="footnote" color="secondary" style={{ padding: space.lg, paddingTop: space.xs }}>{transferencia.mensaje}</Text> : null}
        </View>
      ) : null}
      {c.metodo === 'mercadopago' && link ? <Button label={textos.abrirMercadoPago} size="lg" full onPress={() => void Linking.openURL(link)} /> : null}

      <View style={styles.espera}>
        <ActivityIndicator color={colors.tint} />
        <Text variant="callout" weight="600">{textos.yaTransferi}</Text>
      </View>
      <Text variant="footnote" color="secondary" align="center">{textos.esperandoConfirmacion}</Text>
      <Button label={textos.cancelarPago} variant="plain" loading={cancelar.isPending} onPress={() => cancelar.mutate()} />
    </View>
  );
}

function Dato({ k, v, grande, onCopiar, copiado, textos }: { k: string; v: string; grande?: boolean; onCopiar?: () => void; copiado?: boolean; textos?: Textos }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dato}>
      <View style={{ flex: 1 }}>
        <Text variant="footnote" color="secondary">{k}</Text>
        <Text variant={grande ? 'title3' : 'body'} weight={grande ? '700' : '500'} numeric selectable>{v}</Text>
      </View>
      {onCopiar && textos ? (
        <PressableScale onPress={onCopiar} accessibilityLabel={`${textos.copiar} ${k}`} style={[styles.copiar, { backgroundColor: colors.tintSoft }]}>
          {copiado ? <Check size={16} color={colors.tint} strokeWidth={3} /> : <Copy size={16} color={colors.tint} />}
          <Text variant="footnote" weight="600" color="tint">{copiado ? textos.copiado : textos.copiar}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function Metodo({ icono, titulo, detalle, activo, onPress }: { icono: React.ReactNode; titulo: string; detalle: string; activo: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={() => { haptic.seleccion(); onPress(); }} accessibilityLabel={titulo} accessibilityState={{ selected: activo }} style={[styles.metodo, { backgroundColor: colors.surface, borderColor: activo ? colors.tint : 'transparent' }]}>
      {icono}
      <View style={{ flex: 1 }}>
        <Text variant="headline">{titulo}</Text>
        <Text variant="footnote" color="secondary">{detalle}</Text>
      </View>
      <View style={[styles.radio, { borderColor: activo ? colors.tint : colors.labelTertiary }]}>{activo ? <View style={[styles.radioInterno, { backgroundColor: colors.tint }]} /> : null}</View>
    </PressableScale>
  );
}

function Fila({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <View style={styles.fila}>
      <Text variant={fuerte ? 'headline' : 'callout'} color={fuerte ? 'label' : 'secondary'}>{k}</Text>
      <Text variant={fuerte ? 'title3' : 'callout'} numeric weight={fuerte ? '700' : '500'}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.lg, paddingBottom: space.lg },
  pila: { gap: space.lg },
  centro: { alignItems: 'center', gap: space.lg, padding: space.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  caja: { borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous' },
  filaCaja: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg, gap: space.lg },
  unidad: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 48 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  importe: { fontSize: 22, minWidth: 110, textAlign: 'right', outlineStyle: 'none' as never },
  metodo: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 2, borderCurve: 'continuous' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInterno: { width: 12, height: 12, borderRadius: 6 },
  resumen: { padding: space.lg, borderRadius: radius.lg, gap: space.sm },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dato: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  copiar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
  espera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, paddingTop: space.md },
});
