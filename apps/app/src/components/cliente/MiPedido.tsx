import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { BellRing, Receipt, Trash2 } from 'lucide-react-native';
import { enviarSolicitud, type ProductoCarta } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Button, EmptyState, ErrorBanner, PressableScale, Stepper, Text, fontFor, haptic, radius, space, useTheme } from '@vase/ui';
import { FotoPlato } from '@/components/FotoPlato';
import { useCliente } from '@/lib/cliente';
import type { Textos } from '@/lib/i18n';

interface Props {
  numeroMesa: number;
  porId: Map<string, ProductoCarta>;
  textos: Textos;
  pedidosQr: boolean;
  pendientes: number;
  onIrALaCarta: () => void;
}

/** El pedido que arma el cliente: se envía como solicitud y el mozo lo confirma. */
export function MiPedido({ numeroMesa, porId, textos, pedidosQr, pendientes, onIrALaCarta }: Props) {
  const { colors } = useTheme();
  const { lineas, fijar, fijarNotas, vaciar } = useCliente();
  const [aviso, setAviso] = useState<string | null>(null);
  const visibles = lineas.filter((l) => porId.has(l.productoId));
  const total = visibles.reduce((s, l) => s + (porId.get(l.productoId)?.precio ?? 0) * l.cantidad, 0);

  const pedir = useMutation({
    mutationFn: () => enviarSolicitud(numeroMesa, { tipo: 'pedido', items: visibles.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, notas: l.notas })) }),
    onSuccess: () => { vaciar(); haptic.exito(); setAviso(textos.pedidoEnviado); },
    onError: () => haptic.error(),
  });
  const llamar = useMutation({
    mutationFn: (tipo: 'mozo' | 'cuenta') => enviarSolicitud(numeroMesa, { tipo }),
    onSuccess: () => { haptic.exito(); setAviso(textos.mozoAvisado); },
    onError: () => haptic.error(),
  });

  return (
    <View style={styles.pila}>
      {aviso ? <View style={[styles.aviso, { backgroundColor: colors.tintSoft }]}><Text variant="callout" weight="600" color="tint">{aviso}</Text></View> : null}
      {pendientes > 0 ? <Text variant="footnote" color="secondary" align="center">{textos.pedidoEnEspera(pendientes)}</Text> : null}

      {!pedidosQr ? (
        <Text variant="callout" color="secondary" align="center">{textos.pedidosDeshabilitados}</Text>
      ) : visibles.length === 0 ? (
        <EmptyState icon={<Receipt size={30} color={colors.labelSecondary} />} title={textos.miPedido} message={textos.pedidoVacio} action={<Button label={textos.tabCarta} variant="tinted" onPress={onIrALaCarta} />} />
      ) : (
        <>
          <View style={[styles.lista, { backgroundColor: colors.surface }]}>
            {visibles.map((l, i) => {
              const p = porId.get(l.productoId)!;
              return (
                <View key={l.productoId} style={[styles.linea, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
                  <View style={styles.cabecera}>
                    {p.imagenUrl ? <FotoPlato ruta={p.imagenUrl} ancho={52} radio={10} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text variant="headline" numberOfLines={2}>{p.nombre}</Text>
                      <Text variant="subhead" color="secondary" numeric>{formatearARS(p.precio * l.cantidad, true)}</Text>
                    </View>
                    <Stepper value={l.cantidad} min={0} max={20} onChange={(n) => fijar(l.productoId, n)} label={p.nombre} />
                  </View>
                  <TextInput
                    value={l.notas}
                    onChangeText={(t) => fijarNotas(l.productoId, t)}
                    placeholder={textos.notaCocina}
                    placeholderTextColor={colors.labelTertiary}
                    selectionColor={colors.tint}
                    accessibilityLabel={`${textos.notaCocina}: ${p.nombre}`}
                    maxLength={140}
                    style={[styles.nota, fontFor('400'), { backgroundColor: colors.fillSoft, color: colors.label }]}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.total}>
            <Text variant="headline">{textos.total}</Text>
            <Text variant="title3" weight="700" numeric>{formatearARS(total, true)}</Text>
          </View>
          {pedir.isError ? <ErrorBanner message={pedir.error instanceof Error ? pedir.error.message : textos.error} /> : null}
          <Button label={textos.pedirAlMozo} size="lg" full loading={pedir.isPending} onPress={() => { setAviso(null); pedir.mutate(); }} />
          <PressableScale onPress={() => { vaciar(); haptic.medio(); }} accessibilityLabel={textos.quitar} style={styles.vaciar}>
            <Trash2 size={16} color={colors.labelSecondary} />
            <Text variant="footnote" color="secondary">{textos.quitar}</Text>
          </PressableScale>
        </>
      )}

      <View style={styles.llamados}>
        <Button label={textos.llamarMozo} variant="tinted" icon={<BellRing size={18} color={colors.tint} />} loading={llamar.isPending && llamar.variables === 'mozo'} onPress={() => { setAviso(null); llamar.mutate('mozo'); }} full />
        <Button label={textos.pedirCuenta} variant="plain" loading={llamar.isPending && llamar.variables === 'cuenta'} onPress={() => { setAviso(null); llamar.mutate('cuenta'); }} full />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.lg },
  aviso: { padding: space.lg, borderRadius: radius.lg },
  lista: { borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous' },
  linea: { padding: space.lg, gap: space.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nota: { fontSize: 15, paddingHorizontal: space.md, paddingVertical: space.sm + 2, borderRadius: radius.sm, outlineStyle: 'none' as never },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.sm },
  vaciar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: 36 },
  llamados: { gap: space.xs, marginTop: space.md },
});
