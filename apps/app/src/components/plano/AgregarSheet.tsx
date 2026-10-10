import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ETIQUETA_ELEMENTO, type FormaMesa, type Mesa, type TipoElemento } from '@vase/domain';
import { PressableScale, Sheet, Text, haptic, planoMaterial, radius, space, useTheme } from '@vase/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  sinUbicar: readonly Mesa[];
  onMesa: (forma: FormaMesa, existente?: Mesa) => void;
  onZona: () => void;
  onElemento: (tipo: TipoElemento) => void;
}

function Icono({ tipo }: { tipo: string }) {
  const { dark, colors } = useTheme();
  const m = planoMaterial[dark ? 'dark' : 'light'];
  const s = { width: 56, height: 44, viewBox: '0 0 56 44' };
  switch (tipo) {
    case 'circular': return <Svg {...s}><Circle cx={28} cy={22} r={12} fill={m.mesa} stroke={m.borde} strokeWidth={2} />{[0, 90, 180, 270].map((a) => <Circle key={a} cx={28 + Math.cos((a * Math.PI) / 180) * 18} cy={22 + Math.sin((a * Math.PI) / 180) * 18} r={4.5} fill={m.respaldo} />)}</Svg>;
    case 'cuadrada': return <Svg {...s}><Rect x={17} y={11} width={22} height={22} rx={4} fill={m.mesa} stroke={m.borde} strokeWidth={2} /><Rect x={22} y={2} width={12} height={6} rx={3} fill={m.respaldo} /><Rect x={22} y={36} width={12} height={6} rx={3} fill={m.respaldo} /><Rect x={6} y={16} width={6} height={12} rx={3} fill={m.respaldo} /><Rect x={44} y={16} width={6} height={12} rx={3} fill={m.respaldo} /></Svg>;
    case 'rectangular': return <Svg {...s}><Rect x={8} y={13} width={40} height={18} rx={5} fill={m.mesa} stroke={m.borde} strokeWidth={2} />{[14, 28, 42].map((x) => <Rect key={x} x={x - 5} y={4} width={10} height={6} rx={3} fill={m.respaldo} />)}{[14, 28, 42].map((x) => <Rect key={`b${x}`} x={x - 5} y={34} width={10} height={6} rx={3} fill={m.respaldo} />)}</Svg>;
    case 'zona': return <Svg {...s}><Rect x={4} y={6} width={48} height={32} rx={8} fill={colors.tint} fillOpacity={0.12} stroke={colors.tint} strokeOpacity={0.5} strokeWidth={2} /></Svg>;
    case 'barra': return <Svg {...s}><Rect x={4} y={15} width={48} height={14} rx={5} fill={m.barra} /></Svg>;
    case 'pared': return <Svg {...s}><Rect x={4} y={19} width={48} height={6} rx={2} fill={m.pared} /></Svg>;
    case 'puerta': return <Svg {...s}><Path d="M 14 36 L 14 10 A 26 26 0 0 1 40 36" stroke={m.pared} strokeWidth={2} fill="none" strokeDasharray="4 3" /><Path d="M14 36 L14 10" stroke={m.pared} strokeWidth={3} /></Svg>;
    case 'ventana': return <Svg {...s}><Rect x={4} y={18} width={48} height={8} fill={m.vidrio} fillOpacity={0.3} stroke={m.vidrio} strokeWidth={2} /></Svg>;
    case 'planta': return <Svg {...s}><Circle cx={28} cy={22} r={14} fill={m.plantaClara} /><Circle cx={22} cy={18} r={6} fill={m.planta} /><Circle cx={34} cy={20} r={6} fill={m.planta} /><Circle cx={27} cy={29} r={6} fill={m.planta} /></Svg>;
    case 'columna': return <Svg {...s}><Rect x={19} y={13} width={18} height={18} rx={2} fill={m.pared} /></Svg>;
    case 'escalera': return <Svg {...s}><Rect x={16} y={4} width={24} height={36} fill={m.ambiente} stroke={m.pared} strokeWidth={2} />{[11, 18, 25, 32].map((y) => <Rect key={y} x={16} y={y} width={24} height={1.5} fill={m.pared} />)}</Svg>;
    case 'pasillo': return <Svg {...s}><Path d="M 6 22 L 42 22" stroke={m.pared} strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" /><Path d="M 40 15 L 50 22 L 40 29" stroke={m.pared} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    default: return <Svg {...s}><Rect x={6} y={8} width={44} height={28} rx={6} fill={m.ambiente} stroke={m.borde} strokeWidth={2} /></Svg>;
  }
}

function Opcion({ tipo, titulo, onPress }: { tipo: string; titulo: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={() => { haptic.ligero(); onPress(); }} accessibilityLabel={`Agregar ${titulo}`} style={[styles.opcion, { backgroundColor: colors.surface }]}>
      <Icono tipo={tipo} />
      <Text variant="footnote" weight="600" align="center" numberOfLines={1}>{titulo}</Text>
    </PressableScale>
  );
}

const ELEMENTOS: TipoElemento[] = ['barra', 'caja', 'cocina', 'bano', 'pared', 'puerta', 'ventana', 'escalera', 'pasillo', 'planta', 'columna'];

export function AgregarSheet({ open, onClose, sinUbicar, onMesa, onZona, onElemento }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Agregar al plano">
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={styles.cuerpo} showsVerticalScrollIndicator={false}>
        {sinUbicar.length > 0 ? (
          <View style={styles.seccion}>
            <Text variant="footnote" color="secondary" style={styles.titulo}>Mesas sin ubicar</Text>
            <View style={styles.grilla}>
              {sinUbicar.map((m) => <Opcion key={m.id} tipo={m.forma} titulo={`Mesa ${m.numero}`} onPress={() => onMesa(m.forma, m)} />)}
            </View>
          </View>
        ) : null}
        <View style={styles.seccion}>
          <Text variant="footnote" color="secondary" style={styles.titulo}>Mesa nueva</Text>
          <View style={styles.grilla}>
            <Opcion tipo="circular" titulo="Redonda" onPress={() => onMesa('circular')} />
            <Opcion tipo="cuadrada" titulo="Cuadrada" onPress={() => onMesa('cuadrada')} />
            <Opcion tipo="rectangular" titulo="Rectangular" onPress={() => onMesa('rectangular')} />
          </View>
        </View>
        <View style={styles.seccion}>
          <Text variant="footnote" color="secondary" style={styles.titulo}>Espacio</Text>
          <View style={styles.grilla}>
            <Opcion tipo="zona" titulo="Zona" onPress={onZona} />
            {ELEMENTOS.map((t) => <Opcion key={t} tipo={t} titulo={ETIQUETA_ELEMENTO[t]} onPress={() => onElemento(t)} />)}
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.xl, paddingBottom: space.md },
  seccion: { gap: space.sm },
  titulo: { paddingHorizontal: space.xs },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  opcion: { width: 104, paddingVertical: space.md, paddingHorizontal: space.sm, alignItems: 'center', gap: space.xs, borderRadius: radius.md, borderCurve: 'continuous' },
});
