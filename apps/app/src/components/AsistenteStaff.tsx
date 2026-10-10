import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mic, Send, Sparkles, Square } from 'lucide-react-native';
import { ejecutarAcciones, interpretarComando, type AccionAsistente, type ResultadoComando } from '@vase/api';
import { aCentavos, formatearARS } from '@vase/domain';
import { Button, Chip, ErrorBanner, PressableScale, Sheet, Text, fontFor, haptic, radius, space, useTheme } from '@vase/ui';
import { useDictado } from '@/lib/dictado';

interface Props { open: boolean; onClose: () => void; onHecho: (mensaje: string) => void }

const EJEMPLOS = ['Marcá agotado el bife', 'Subí 8 % las bebidas', 'Poné el flan a 6500', 'Qué platos están agotados', 'Volvió el flan'];
const pesos = (n: number) => formatearARS(aCentavos(n), true);

/** Órdenes en lenguaje natural: se muestra exactamente qué cambia (antes y después) y recién se aplica al confirmar. */
export function AsistenteStaff({ open, onClose, onHecho }: Props) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState('');
  const [resultado, setResultado] = useState<ResultadoComando | null>(null);
  const dictado = useDictado('es');

  const interpretar = useMutation({
    mutationFn: (t: string) => interpretarComando(t),
    onSuccess: (r) => { setResultado(r); haptic.ligero(); },
    onError: () => haptic.error(),
  });
  const aplicar = useMutation({
    mutationFn: (acciones: AccionAsistente[]) => ejecutarAcciones(acciones),
    onSuccess: async (r) => {
      haptic.exito();
      await queryClient.invalidateQueries({ queryKey: ['menu'] });
      onHecho(r.cambios.length ? `Listo: ${r.cambios.length} ${r.cambios.length === 1 ? 'cambio aplicado' : 'cambios aplicados'}` : 'No había nada que cambiar');
      cerrar();
    },
    onError: () => haptic.error(),
  });

  const enviar = (t: string) => {
    const limpio = t.trim();
    if (!limpio) return;
    setConsulta(limpio);
    setTexto('');
    setResultado(null);
    interpretar.mutate(limpio);
  };
  const cerrar = () => { dictado.parar(); setTexto(''); setConsulta(''); setResultado(null); interpretar.reset(); aplicar.reset(); onClose(); };

  const acciones = resultado?.acciones ?? [];
  const total = acciones.reduce((s, a) => s + a.productos.length, 0);

  return (
    <Sheet
      open={open}
      onClose={cerrar}
      title="Asistente"
      footer={acciones.length ? <Button label={`Aplicar ${total} ${total === 1 ? 'cambio' : 'cambios'}`} size="lg" full loading={aplicar.isPending} onPress={() => aplicar.mutate(acciones)} /> : undefined}
    >
      <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!consulta ? (
          <>
            <Text variant="callout" color="secondary" align="center">Decime o escribime qué querés cambiar en la carta. Antes de tocar nada te muestro el resultado y esperás tu confirmación.</Text>
            <View style={styles.ejemplos}>{EJEMPLOS.map((e) => <Chip key={e} label={e} onPress={() => enviar(e)} />)}</View>
          </>
        ) : (
          <View style={{ gap: space.md }}>
            <View style={[styles.burbujaYo, { backgroundColor: colors.tint }]}><Text variant="callout" style={{ color: colors.onTint }}>{consulta}</Text></View>
            {interpretar.isPending ? <Text variant="callout" color="secondary">Entendiendo…</Text> : null}
            {interpretar.isError ? <ErrorBanner message={interpretar.error instanceof Error ? interpretar.error.message : 'No se pudo interpretar'} /> : null}
            {aplicar.isError ? <ErrorBanner message={aplicar.error instanceof Error ? aplicar.error.message : 'No se pudo aplicar'} /> : null}

            {resultado?.noEntendido.map((n) => <View key={n} style={[styles.aviso, { backgroundColor: colors.dangerSoft }]}><Text variant="callout" color="danger">{n}</Text></View>)}

            {resultado?.respuesta?.tipo === 'agotados' ? (
              <View style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
                <Text variant="headline">{resultado.respuesta.productos.length ? 'Platos agotados' : 'No hay platos agotados'}</Text>
                {resultado.respuesta.productos.map((p) => <Text key={p.id} variant="callout">{p.nombre}</Text>)}
              </View>
            ) : null}

            {acciones.map((a, i) => (
              <View key={i} style={[styles.tarjeta, { backgroundColor: colors.surface }]}>
                <View style={styles.cabecera}>
                  <Sparkles size={18} color={colors.tint} />
                  <Text variant="headline" style={{ flex: 1 }}>{a.resumen}</Text>
                  <Text variant="footnote" color="secondary">{`${a.productos.length} ${a.productos.length === 1 ? 'plato' : 'platos'}`}</Text>
                </View>
                {a.productos.slice(0, 12).map((p) => (
                  <View key={p.id} style={styles.fila}>
                    <Text variant="callout" style={{ flex: 1 }} numberOfLines={1}>{p.nombre}</Text>
                    {p.precioNuevo !== undefined ? (
                      <Text variant="callout" numeric>
                        <Text variant="callout" color="secondary" numeric style={styles.tachado}>{pesos(p.precioActual)}</Text>{`  →  `}<Text variant="callout" weight="700" numeric color="tint">{pesos(p.precioNuevo)}</Text>
                      </Text>
                    ) : (
                      <Text variant="callout" color="secondary">{a.tipo === 'agotado' ? (p.disponible ? 'disponible → agotado' : 'ya estaba agotado') : p.disponible ? 'ya estaba disponible' : 'agotado → disponible'}</Text>
                    )}
                  </View>
                ))}
                {a.productos.length > 12 ? <Text variant="footnote" color="secondary">{`y ${a.productos.length - 12} más…`}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.entrada, { backgroundColor: colors.fill }]}>
        <TextInput
          value={dictado.escuchando ? dictado.texto : texto}
          onChangeText={setTexto}
          editable={!dictado.escuchando}
          placeholder={dictado.escuchando ? 'Escuchando…' : 'Ej.: subí 8 % las bebidas'}
          placeholderTextColor={colors.labelSecondary}
          selectionColor={colors.tint}
          accessibilityLabel="Orden para el asistente"
          returnKeyType="send"
          onSubmitEditing={() => enviar(texto)}
          style={[styles.input, fontFor('400'), { color: colors.label }]}
        />
        {dictado.disponible ? (
          <PressableScale onPress={() => { haptic.ligero(); if (dictado.escuchando) dictado.parar(); else void dictado.empezar(enviar); }} accessibilityLabel={dictado.escuchando ? 'Detener' : 'Hablar'} style={[styles.boton, { backgroundColor: dictado.escuchando ? colors.danger : colors.surface }]}>
            {dictado.escuchando ? <Square size={16} color="#fff" fill="#fff" /> : <Mic size={20} color={colors.tint} />}
          </PressableScale>
        ) : null}
        <PressableScale onPress={() => enviar(texto)} disabled={!texto.trim()} accessibilityLabel="Enviar" style={[styles.boton, { backgroundColor: colors.tint, opacity: texto.trim() ? 1 : 0.4 }]}>
          <Send size={18} color={colors.onTint} />
        </PressableScale>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.lg, paddingBottom: space.lg },
  ejemplos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  burbujaYo: { alignSelf: 'flex-end', maxWidth: '88%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg, borderBottomRightRadius: 6 },
  aviso: { padding: space.lg, borderRadius: radius.lg },
  tarjeta: { padding: space.lg, borderRadius: radius.lg, gap: space.sm, borderCurve: 'continuous' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tachado: { textDecorationLine: 'line-through' },
  entrada: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs, paddingLeft: space.lg, borderRadius: radius.pill },
  input: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: space.md, outlineStyle: 'none' as never },
  boton: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
