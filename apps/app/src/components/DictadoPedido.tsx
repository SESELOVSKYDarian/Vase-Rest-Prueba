import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Mic, Square } from 'lucide-react-native';
import { interpretarPedidoDictado, type LineaDictada } from '@vase/api';
import { Button, Chip, ErrorBanner, PressableScale, Sheet, Stepper, Text, fontFor, haptic, radius, space, useTheme } from '@vase/ui';
import { useDictado } from '@/lib/dictado';

interface Props {
  open: boolean;
  onClose: () => void;
  onAgregar: (lineas: Array<{ productoId: string; cantidad: number; notas: string }>) => void;
}

/** Dictar el pedido: "dos milas napo, una sin jamón y una malbec" → líneas de la carta para revisar y sumar. */
export function DictadoPedido({ open, onClose, onAgregar }: Props) {
  const { colors } = useTheme();
  const [texto, setTexto] = useState('');
  const [lineas, setLineas] = useState<LineaDictada[]>([]);
  const [noEntendido, setNoEntendido] = useState<string[]>([]);
  const dictado = useDictado('es');

  const entender = useMutation({
    mutationFn: (t: string) => interpretarPedidoDictado(t),
    onSuccess: (r) => { setLineas(r.lineas); setNoEntendido(r.noEntendido); haptic.ligero(); },
    onError: () => haptic.error(),
  });
  const procesar = (t: string) => { const limpio = t.trim(); if (limpio) { setTexto(limpio); entender.mutate(limpio); } };
  const cerrar = () => { dictado.parar(); setTexto(''); setLineas([]); setNoEntendido([]); entender.reset(); onClose(); };
  const validas = lineas.filter((l) => l.cantidad > 0 && !l.agotado);

  return (
    <Sheet
      open={open}
      onClose={cerrar}
      title="Dictar pedido"
      footer={validas.length ? <Button label={`Agregar ${validas.reduce((s, l) => s + l.cantidad, 0)} al pedido`} size="lg" full onPress={() => { onAgregar(validas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, notas: l.notas }))); haptic.exito(); cerrar(); }} /> : undefined}
    >
      <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {dictado.disponible ? (
          <View style={styles.centro}>
            <PressableScale
              onPress={() => { haptic.medio(); if (dictado.escuchando) dictado.parar(); else void dictado.empezar(procesar); }}
              accessibilityLabel={dictado.escuchando ? 'Detener' : 'Hablar'}
              style={[styles.mic, { backgroundColor: dictado.escuchando ? colors.danger : colors.tint }]}
            >
              {dictado.escuchando ? <Square size={26} color="#fff" fill="#fff" /> : <Mic size={30} color={colors.onTint} />}
            </PressableScale>
            <Text variant="callout" color="secondary" align="center">
              {dictado.escuchando ? (dictado.texto || 'Escuchando…') : 'Tocá y decí el pedido. Ej.: “dos milas napo, una sin jamón y una malbec”.'}
            </Text>
          </View>
        ) : (
          <Text variant="callout" color="secondary" align="center">Este dispositivo no tiene dictado por voz. Escribí el pedido acá abajo.</Text>
        )}
        {dictado.error ? <Text variant="footnote" color="danger" align="center">{dictado.error}</Text> : null}

        <View style={[styles.barra, { backgroundColor: colors.fill }]}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="O escribilo: 2 milas napo, 1 malbec…"
            placeholderTextColor={colors.labelSecondary}
            selectionColor={colors.tint}
            accessibilityLabel="Pedido escrito"
            returnKeyType="go"
            onSubmitEditing={() => procesar(texto)}
            style={[styles.input, fontFor('400'), { color: colors.label }]}
          />
          <Button label="Entender" size="sm" loading={entender.isPending} disabled={!texto.trim()} onPress={() => procesar(texto)} />
        </View>

        {entender.isError ? <ErrorBanner message={entender.error instanceof Error ? entender.error.message : 'No se pudo entender el pedido'} /> : null}

        {lineas.length ? (
          <View style={[styles.lista, { backgroundColor: colors.surface }]}>
            {lineas.map((l, i) => (
              <View key={`${l.productoId}-${i}`} style={[styles.linea, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="headline" numberOfLines={2}>{l.nombre}</Text>
                  {l.notas ? <Text variant="subhead" color="secondary">{l.notas}</Text> : null}
                  {l.agotado ? <Text variant="footnote" weight="600" color="danger">Agotado: no se agrega</Text> : null}
                  {l.ambiguo ? (
                    <View style={styles.alternativas}>
                      <Text variant="footnote" color="secondary">¿O era…?</Text>
                      {l.alternativas.map((a) => <Chip key={a.id} label={a.nombre} onPress={() => setLineas(lineas.map((x, k) => (k === i ? { ...x, productoId: a.id, nombre: a.nombre, ambiguo: false, alternativas: [] } : x)))} />)}
                    </View>
                  ) : null}
                </View>
                <Stepper value={l.cantidad} min={0} max={30} onChange={(n) => setLineas(lineas.map((x, k) => (k === i ? { ...x, cantidad: n } : x)))} label={l.nombre} />
              </View>
            ))}
          </View>
        ) : null}
        {noEntendido.length ? (
          <View style={[styles.aviso, { backgroundColor: colors.dangerSoft }]}>
            <Text variant="footnote" weight="600" color="danger">No encontré en la carta:</Text>
            {noEntendido.map((n) => <Text key={n} variant="callout" color="danger">{`“${n}”`}</Text>)}
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.lg, paddingBottom: space.lg },
  centro: { alignItems: 'center', gap: space.md },
  mic: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
  barra: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs, paddingLeft: space.lg, borderRadius: radius.pill },
  input: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: space.md, outlineStyle: 'none' as never },
  lista: { borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous' },
  linea: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  alternativas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  aviso: { padding: space.lg, borderRadius: radius.lg, gap: 2 },
});
