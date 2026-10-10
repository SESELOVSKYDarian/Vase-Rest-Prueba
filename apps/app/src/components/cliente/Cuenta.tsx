import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight, Receipt } from 'lucide-react-native';
import type { Idioma, MesaQr } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Button, EmptyState, PressableScale, Sheet, Text, radius, space, useTheme } from '@vase/ui';
import { comprobantesGuardados } from '@/lib/cliente';
import type { Textos } from '@/lib/i18n';
import { ComprobanteVista } from './ComprobanteVista';
import { PagarSheet } from './PagarSheet';

interface Props {
  mesa: MesaQr;
  textos: Textos;
  idioma: Idioma;
  /** Código de un pago al que volver directamente (retorno de Mercado Pago). */
  codigoPagoInicial?: string | null;
}

/** La cuenta de la mesa: qué se pidió, qué está pagado y qué falta, y el botón para pagar. */
export function Cuenta({ mesa, textos, idioma, codigoPagoInicial }: Props) {
  const { colors } = useTheme();
  const [pagando, setPagando] = useState(!!codigoPagoInicial);
  const [verComprobante, setVerComprobante] = useState<string | null>(null);
  const cuenta = mesa.cuenta;
  const guardados = comprobantesGuardados(mesa.mesa.numero);

  return (
    <View style={styles.pila}>
      {!cuenta ? (
        <EmptyState icon={<Receipt size={30} color={colors.labelSecondary} />} title={textos.cuenta} message={guardados.length ? textos.cuentaSaldada : textos.sinConsumos} />
      ) : (
        <>
          <View style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
            {cuenta.items.map((i, k) => (
              <View key={i.id} style={[styles.item, k > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{`${i.cantidad} × ${i.nombre}`}</Text>
                  {i.notas ? <Text variant="footnote" color="secondary">{i.notas}</Text> : null}
                </View>
                <Text variant="body" numeric>{formatearARS(i.subtotal, true)}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.tarjeta, styles.totales, { backgroundColor: colors.surface }]}>
            <Fila k={textos.subtotal} v={formatearARS(cuenta.subtotal, true)} />
            {!mesa.ivaIncluido ? <Fila k={textos.iva} v={formatearARS(cuenta.impuestos, true)} /> : null}
            <Fila k={textos.total} v={formatearARS(cuenta.total, true)} fuerte />
            {cuenta.pagado > 0 ? <Fila k={textos.yaPagado} v={`− ${formatearARS(cuenta.pagado, true)}`} tinte /> : null}
            {cuenta.reservado > 0 ? <Fila k={textos.enProceso} v={`− ${formatearARS(cuenta.reservado, true)}`} /> : null}
            <View style={[styles.separador, { backgroundColor: colors.separator }]} />
            <Fila k={textos.faltaPagar} v={formatearARS(cuenta.pendiente, true)} fuerte />
          </View>

          {cuenta.pendiente > 0 ? (
            <Button label={textos.pagar} size="lg" full onPress={() => setPagando(true)} />
          ) : cuenta.reservado > 0 ? (
            <Button label={textos.yaTransferi} size="lg" variant="tinted" full onPress={() => setPagando(true)} />
          ) : null}
        </>
      )}

      {guardados.length ? (
        <View style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
          {guardados.map((codigo, k) => (
            <PressableScale key={codigo} onPress={() => setVerComprobante(codigo)} scaleTo={0.99} accessibilityLabel={`${textos.comprobante} ${codigo}`} style={[styles.item, k > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
              <View style={{ flex: 1 }}>
                <Text variant="footnote" color="secondary">{textos.comprobante}</Text>
                <Text variant="headline" numeric>{codigo}</Text>
              </View>
              <ChevronRight size={18} color={colors.labelTertiary} />
            </PressableScale>
          ))}
        </View>
      ) : null}

      <PagarSheet open={pagando} onClose={() => setPagando(false)} mesa={mesa} textos={textos} idioma={idioma} codigoInicial={codigoPagoInicial} />
      <Sheet open={!!verComprobante} onClose={() => setVerComprobante(null)} title={textos.comprobante}>
        {verComprobante ? <ComprobanteVista codigo={verComprobante} textos={textos} idioma={idioma} /> : null}
      </Sheet>
    </View>
  );
}

function Fila({ k, v, fuerte, tinte }: { k: string; v: string; fuerte?: boolean; tinte?: boolean }) {
  return (
    <View style={styles.fila}>
      <Text variant={fuerte ? 'headline' : 'callout'} color={fuerte ? 'label' : 'secondary'}>{k}</Text>
      <Text variant={fuerte ? 'title3' : 'callout'} numeric weight={fuerte ? '700' : '500'} color={tinte ? 'tint' : 'label'}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.lg },
  tarjeta: { borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  totales: { padding: space.lg, gap: space.sm },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  separador: { height: StyleSheet.hairlineWidth, marginVertical: space.xs },
});
