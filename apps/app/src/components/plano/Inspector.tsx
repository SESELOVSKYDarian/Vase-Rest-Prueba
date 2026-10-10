import { ScrollView, StyleSheet, View } from 'react-native';
import { ImagePlus, Minus, Plus, RotateCcw, RotateCw, Sparkles, Trash2 } from 'lucide-react-native';
import { COLORES_ZONA, ETIQUETA_ELEMENTO, type FormaMesa, type Mesa } from '@vase/domain';
import { Button, Field, Group, PressableScale, Row, Segmented, Stepper, Text, haptic, radius, space, useTheme, zonaColor } from '@vase/ui';
import type { EditorPlano } from './useEditorPlano';

const metros = (cm: number) => `${(cm / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })} m`;

/** Fila con − / + para medidas (en cm, mostradas en metros). */
function Medida({ titulo, valor, paso, min, max, onCambiar }: { titulo: string; valor: number; paso: number; min: number; max: number; onCambiar: (v: number) => void }) {
  const { colors } = useTheme();
  const ir = (d: number) => {
    const v = Math.min(max, Math.max(min, valor + d));
    if (v !== valor) { haptic.seleccion(); onCambiar(v); }
  };
  return (
    <Row
      title={titulo}
      value={metros(valor)}
      trailing={
        <View style={[styles.par, { backgroundColor: colors.fill }]}>
          <PressableScale onPress={() => ir(-paso)} accessibilityLabel={`Achicar ${titulo}`} style={styles.parBoton}><Minus size={16} color={colors.label} /></PressableScale>
          <PressableScale onPress={() => ir(paso)} accessibilityLabel={`Agrandar ${titulo}`} style={styles.parBoton}><Plus size={16} color={colors.label} /></PressableScale>
        </View>
      }
    />
  );
}

function Rotar({ onRotar, paso = 45 }: { onRotar: (delta: number) => void; paso?: number }) {
  const { colors } = useTheme();
  return (
    <Row
      title="Rotar"
      trailing={
        <View style={[styles.par, { backgroundColor: colors.fill }]}>
          <PressableScale onPress={() => { haptic.seleccion(); onRotar(-paso); }} accessibilityLabel="Rotar a la izquierda" style={styles.parBoton}><RotateCcw size={16} color={colors.label} /></PressableScale>
          <PressableScale onPress={() => { haptic.seleccion(); onRotar(paso); }} accessibilityLabel="Rotar a la derecha" style={styles.parBoton}><RotateCw size={16} color={colors.label} /></PressableScale>
        </View>
      }
    />
  );
}

const FORMAS: ReadonlyArray<{ value: FormaMesa; label: string }> = [
  { value: 'circular', label: 'Redonda' },
  { value: 'cuadrada', label: 'Cuadrada' },
  { value: 'rectangular', label: 'Rectangular' },
];

interface Props {
  editor: EditorPlano;
  mesas: readonly Mesa[];
  onSubirFondo: () => void;
  subiendoFondo: boolean;
  onAnalizar: () => void;
}

/** Propiedades de lo elegido; si no hay nada elegido, las del plano (tamaño del local y fondo). */
export function Inspector({ editor, mesas, onSubirFondo, subiendoFondo, onAnalizar }: Props) {
  const { colors, dark } = useTheme();
  const { plano, seleccion } = editor;

  if (seleccion?.tipo === 'mesa') {
    const m = plano.mesas.find((x) => x.mesaId === seleccion.id);
    if (!m) return null;
    const numero = editor.numeros[m.mesaId] ?? 0;
    const existente = mesas.some((x) => x.id === m.mesaId);
    return (
      <View style={styles.cuerpo}>
        <Group header={existente ? 'Mesa' : 'Mesa nueva (se crea al guardar)'} footer={editor.repetidos.has(numero) ? 'Ese número ya lo tiene otra mesa.' : undefined}>
          <Row title="Número" trailing={<Stepper value={numero} min={1} max={999} onChange={(n) => editor.fijarNumero(m.mesaId, n)} label="número de mesa" />} />
          <Row title="Lugares" trailing={<Stepper value={m.asientos} min={1} max={20} onChange={(n) => editor.cambiarMesa(m.mesaId, { asientos: n })} label="lugares" />} />
          <Rotar onRotar={(d) => editor.cambiarMesa(m.mesaId, { rot: (m.rot + d + 360) % 360 })} />
        </Group>
        <Segmented items={FORMAS} value={m.forma} onChange={(forma) => editor.cambiarMesa(m.mesaId, { forma })} accessibilityLabel="Forma de la mesa" />
        <Button label="Quitar del plano" variant="destructive" icon={<Trash2 size={18} color={colors.danger} />} onPress={() => editor.quitar(seleccion)} full />
      </View>
    );
  }

  if (seleccion?.tipo === 'zona') {
    const z = plano.zonas.find((x) => x.id === seleccion.id);
    if (!z) return null;
    return (
      <View style={styles.cuerpo}>
        <Group header="Zona">
          <Field label="Nombre" value={z.nombre} onChangeText={(nombre) => editor.cambiarZona(z.id, { nombre: nombre.slice(0, 40) })} placeholder="Terraza, Salón, Patio…" />
          <Medida titulo="Ancho" valor={z.w} paso={50} min={100} max={plano.ancho} onCambiar={(w) => editor.cambiarZona(z.id, { w })} />
          <Medida titulo="Largo" valor={z.h} paso={50} min={100} max={plano.alto} onCambiar={(h) => editor.cambiarZona(z.id, { h })} />
        </Group>
        <View style={styles.colores} accessibilityRole="radiogroup" accessibilityLabel="Color de la zona">
          {COLORES_ZONA.map((c) => {
            const activo = z.color === c;
            const tono = zonaColor[c][dark ? 'dark' : 'light'];
            return (
              <PressableScale key={c} onPress={() => { haptic.seleccion(); editor.cambiarZona(z.id, { color: c }); }} accessibilityRole="radio" accessibilityState={{ selected: activo }} accessibilityLabel={c} style={[styles.color, { backgroundColor: tono, borderColor: activo ? colors.label : 'transparent' }]} />
            );
          })}
        </View>
        <Button label="Eliminar zona" variant="destructive" icon={<Trash2 size={18} color={colors.danger} />} onPress={() => editor.quitar(seleccion)} full />
      </View>
    );
  }

  if (seleccion?.tipo === 'elemento') {
    const e = plano.elementos.find((x) => x.id === seleccion.id);
    if (!e) return null;
    const conRotulo = e.tipo === 'barra' || e.tipo === 'cocina' || e.tipo === 'bano' || e.tipo === 'caja';
    return (
      <View style={styles.cuerpo}>
        <Group header={ETIQUETA_ELEMENTO[e.tipo]}>
          {conRotulo ? <Field label="Rótulo" value={e.etiqueta ?? ''} onChangeText={(etiqueta) => editor.cambiarElemento(e.id, { etiqueta: etiqueta.slice(0, 30) })} placeholder={ETIQUETA_ELEMENTO[e.tipo]} /> : null}
          <Medida titulo="Largo" valor={e.w} paso={e.tipo === 'pared' ? 50 : 10} min={10} max={plano.ancho} onCambiar={(w) => editor.cambiarElemento(e.id, { w })} />
          {e.tipo !== 'puerta' && e.tipo !== 'pared' && e.tipo !== 'ventana' && e.tipo !== 'pasillo' ? <Medida titulo="Ancho" valor={e.h} paso={10} min={10} max={plano.alto} onCambiar={(h) => editor.cambiarElemento(e.id, { h })} /> : null}
          <Rotar paso={e.tipo === 'pared' || e.tipo === 'puerta' || e.tipo === 'ventana' ? 90 : 45} onRotar={(d) => editor.cambiarElemento(e.id, { rot: (e.rot + d + 360) % 360 })} />
        </Group>
        <Button label="Eliminar" variant="destructive" icon={<Trash2 size={18} color={colors.danger} />} onPress={() => editor.quitar(seleccion)} full />
      </View>
    );
  }

  return (
    <View style={styles.cuerpo}>
      <View style={{ gap: space.sm }}>
        <Text variant="footnote" color="secondary" style={{ paddingHorizontal: space.lg + space.xs }}>Estilo del plano</Text>
        <Segmented
          items={[{ value: 'azul', label: 'Arquitecto' }, { value: 'claro', label: 'Claro' }]}
          value={plano.estilo ?? 'azul'}
          onChange={(estilo) => editor.cambiarPlano({ estilo })}
          accessibilityLabel="Estilo del plano"
        />
      </View>
      <Group header="El local" footer="Medidas reales del espacio. El plano se dibuja a escala: una mesa de 4 mide unos 90 cm.">
        <Medida titulo="Ancho" valor={plano.ancho} paso={50} min={400} max={10000} onCambiar={(ancho) => editor.cambiarPlano({ ancho })} />
        <Medida titulo="Largo" valor={plano.alto} paso={50} min={300} max={10000} onCambiar={(alto) => editor.cambiarPlano({ alto })} />
      </Group>
      <Group header="Plano o foto de fondo" footer="Subí el plano del arquitecto, un dibujo o una foto desde arriba y calcá las mesas encima.">
        <Row title={plano.fondo ? 'Cambiar imagen' : 'Subir imagen'} leading={<ImagePlus size={20} color={colors.tint} />} onPress={subiendoFondo ? undefined : onSubirFondo} value={subiendoFondo ? 'Subiendo…' : undefined} chevron />
        {plano.fondo ? (
          <Row title="Quitar imagen" destructive onPress={() => editor.cambiarPlano({ fondo: null })} />
        ) : null}
      </Group>
      {plano.fondo ? (
        <Segmented
          items={[{ value: '0.25', label: 'Tenue' }, { value: '0.5', label: 'Media' }, { value: '0.85', label: 'Fuerte' }]}
          value={String(plano.fondo.opacidad <= 0.3 ? 0.25 : plano.fondo.opacidad <= 0.6 ? 0.5 : 0.85)}
          onChange={(v) => editor.cambiarPlano({ fondo: { ...plano.fondo!, opacidad: Number(v) } })}
          accessibilityLabel="Intensidad del fondo"
        />
      ) : null}
      <Group footer="Lee la imagen del plano y propone mesas, sillas y zonas. Revisás antes de aplicar.">
        <Row title="Armar el plano con IA" leading={<Sparkles size={20} color={colors.tint} />} onPress={onAnalizar} chevron />
      </Group>
      <Text variant="footnote" color="secondary" align="center">Tocá una mesa, zona u objeto para editarlo. Arrastrá para moverlo.</Text>
    </View>
  );
}

export function InspectorScroll(props: Props) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Inspector {...props} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.xl, paddingBottom: space.sm },
  scroll: { padding: space.xl, paddingTop: space.lg },
  par: { flexDirection: 'row', borderRadius: radius.pill, overflow: 'hidden' },
  parBoton: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  colores: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.xs },
  color: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
});
