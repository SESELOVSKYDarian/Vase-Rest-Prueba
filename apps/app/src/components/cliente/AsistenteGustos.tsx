import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import * as Speech from 'expo-speech';
import { Mic, Send, Sparkles, Square, Volume2 } from 'lucide-react-native';
import { pedirRecomendacion, type Idioma, type ProductoCarta, type Recomendacion } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Chip, ErrorBanner, PressableScale, Sheet, Text, fontFor, haptic, radius, space, useTheme } from '@vase/ui';
import { FotoPlato } from '@/components/FotoPlato';
import { useDictado } from '@/lib/dictado';
import { localeDe, mensajeRecomendacion, type Textos } from '@/lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  idioma: Idioma;
  textos: Textos;
  porId: Map<string, ProductoCarta>;
  puedePedir: boolean;
  onAbrir: (plato: ProductoCarta) => void;
  onAgregar: (plato: ProductoCarta) => void;
}

/** "¿Qué se te antoja?": la persona cuenta sus gustos (escribiendo o hablando) y recibe platos de la carta. */
export function AsistenteGustos({ open, onClose, idioma, textos, porId, puedePedir, onAbrir, onAgregar }: Props) {
  const { colors } = useTheme();
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState('');
  const [hablando, setHablando] = useState(false);
  const dictado = useDictado(idioma);
  const respuesta = useRef<Recomendacion | null>(null);

  const pedir = useMutation({
    mutationFn: (t: string) => pedirRecomendacion(t, idioma),
    onSuccess: (r) => { respuesta.current = r; haptic.ligero(); },
  });

  const enviar = (t: string) => {
    const limpio = t.trim();
    if (limpio.length < 2) return;
    Speech.stop();
    setHablando(false);
    setConsulta(limpio);
    setTexto('');
    pedir.mutate(limpio);
  };

  const leer = (mensaje: string) => {
    if (hablando) { Speech.stop(); setHablando(false); return; }
    setHablando(true);
    Speech.speak(mensaje, { language: localeDe(idioma), onDone: () => setHablando(false), onStopped: () => setHablando(false), onError: () => setHablando(false) });
  };

  const r = pedir.data;
  const mensaje = r ? mensajeRecomendacion(r, textos) : '';
  const platos = (r?.ids ?? []).map((id) => porId.get(id)).filter((p): p is ProductoCarta => !!p);

  return (
    <Sheet open={open} onClose={() => { Speech.stop(); dictado.parar(); onClose(); }} title={textos.asistenteTitulo}>
      <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!consulta ? (
          <>
            <Text variant="callout" color="secondary" align="center">{textos.asistenteAyuda}</Text>
            <View style={styles.ejemplos}>
              {textos.ejemplos.map((e) => <Chip key={e} label={e} onPress={() => enviar(e)} />)}
            </View>
          </>
        ) : (
          <View style={{ gap: space.md }}>
            <View style={[styles.burbujaYo, { backgroundColor: colors.tint }]}>
              <Text variant="callout" style={{ color: colors.onTint }}>{consulta}</Text>
            </View>
            {pedir.isPending ? (
              <View style={styles.pensando}><ActivityIndicator color={colors.tint} /><Text variant="callout" color="secondary">{textos.pensando}</Text></View>
            ) : pedir.isError ? (
              <ErrorBanner message={textos.error} />
            ) : r ? (
              <View style={{ gap: space.md }}>
                <View style={[styles.burbuja, { backgroundColor: colors.surface }]}>
                  <Sparkles size={18} color={colors.tint} />
                  <Text variant="callout" style={{ flex: 1 }}>{mensaje}</Text>
                  <PressableScale onPress={() => leer(mensaje)} accessibilityLabel={textos.leerEnVozAlta} style={styles.altavoz}>
                    {hablando ? <Square size={16} color={colors.tint} fill={colors.tint} /> : <Volume2 size={19} color={colors.tint} />}
                  </PressableScale>
                </View>
                {platos.map((p) => (
                  <View key={p.id} style={[styles.plato, { backgroundColor: colors.surface }]}>
                    <PressableScale onPress={() => onAbrir(p)} scaleTo={0.99} accessibilityLabel={p.nombre} style={styles.platoTexto}>
                    <FotoPlato ruta={p.imagenUrl} ancho={64} radio={12} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="headline" numberOfLines={1}>{p.nombre}</Text>
                      <View style={styles.motivos}>
                        {(r.motivos[p.id] ?? []).slice(0, 3).map((m) => (
                          <View key={m} style={[styles.motivo, { backgroundColor: colors.tintSoft }]}><Text variant="caption" weight="600" color="tint">{textos.motivo[m] ?? m}</Text></View>
                        ))}
                      </View>
                      <Text variant="subhead" weight="600" numeric>{formatearARS(p.precio, true)}</Text>
                    </View>
                    </PressableScale>
                    {puedePedir ? (
                      <PressableScale onPress={() => { haptic.ligero(); onAgregar(p); }} accessibilityLabel={`${textos.agregar} ${p.nombre}`} style={[styles.mas, { backgroundColor: colors.tintSoft }]}>
                        <Text variant="title3" color="tint">+</Text>
                      </PressableScale>
                    ) : null}
                  </View>
                ))}
                {r.conceptos.some((c) => ['sin_tacc', 'sin_lactosa', 'vegano', 'vegetariano'].includes(c)) || r.evita.length ? (
                  <Text variant="footnote" color="secondary">{textos.avisoAlergia}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={[styles.barra, { backgroundColor: colors.fill }]}>
        <TextInput
          value={dictado.escuchando ? dictado.texto : texto}
          onChangeText={setTexto}
          editable={!dictado.escuchando}
          placeholder={dictado.escuchando ? textos.escuchando : textos.asistentePlaceholder}
          placeholderTextColor={colors.labelSecondary}
          selectionColor={colors.tint}
          accessibilityLabel={textos.asistentePlaceholder}
          returnKeyType="send"
          onSubmitEditing={() => enviar(texto)}
          style={[styles.input, fontFor('400'), { color: colors.label }]}
        />
        {dictado.disponible ? (
          <PressableScale
            onPress={() => { haptic.ligero(); if (dictado.escuchando) dictado.parar(); else void dictado.empezar(enviar); }}
            accessibilityLabel={dictado.escuchando ? textos.detener : textos.hablar}
            style={[styles.boton, { backgroundColor: dictado.escuchando ? colors.danger : colors.surface }]}
          >
            {dictado.escuchando ? <Square size={16} color="#fff" fill="#fff" /> : <Mic size={20} color={colors.tint} />}
          </PressableScale>
        ) : null}
        <PressableScale onPress={() => enviar(texto)} disabled={texto.trim().length < 2} accessibilityLabel={textos.enviar} style={[styles.boton, { backgroundColor: colors.tint, opacity: texto.trim().length < 2 ? 0.4 : 1 }]}>
          <Send size={18} color={colors.onTint} />
        </PressableScale>
      </View>
      {dictado.error ? <Text variant="footnote" color="danger" align="center" style={{ paddingTop: space.sm }}>{dictado.error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.lg, paddingBottom: space.lg },
  ejemplos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  burbujaYo: { alignSelf: 'flex-end', maxWidth: '85%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg, borderBottomRightRadius: 6 },
  burbuja: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderBottomLeftRadius: 6 },
  altavoz: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pensando: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm },
  plato: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, paddingRight: space.md, borderRadius: radius.lg },
  platoTexto: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  motivos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  motivo: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  mas: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  barra: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs, paddingLeft: space.lg, borderRadius: radius.pill },
  input: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: space.md, outlineStyle: 'none' as never },
  boton: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
