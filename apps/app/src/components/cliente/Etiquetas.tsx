import { StyleSheet, View } from 'react-native';
import { Flame, Leaf, MilkOff, Sprout, WheatOff, type LucideIcon } from 'lucide-react-native';
import type { Etiqueta } from '@vase/api';
import { Text, radius, space, useTheme } from '@vase/ui';
import type { Textos } from '@/lib/i18n';

export const ICONO_ETIQUETA: Record<Etiqueta, LucideIcon> = { sin_tacc: WheatOff, vegano: Leaf, vegetariano: Sprout, sin_lactosa: MilkOff, picante: Flame };

/** Etiqueta chica de un plato (ícono + texto: nunca solo color). */
export function EtiquetaPill({ etiqueta, textos }: { etiqueta: Etiqueta; textos: Textos }) {
  const { colors } = useTheme();
  const Icono = ICONO_ETIQUETA[etiqueta];
  const peligro = etiqueta === 'picante';
  return (
    <View style={[styles.pill, { backgroundColor: peligro ? colors.dangerSoft : colors.tintSoft }]}>
      <Icono size={12} color={peligro ? colors.danger : colors.tint} strokeWidth={2.4} />
      <Text variant="caption" weight="600" style={{ color: peligro ? colors.danger : colors.tint }}>{textos.etiqueta[etiqueta]}</Text>
    </View>
  );
}

export function FilaEtiquetas({ etiquetas, textos }: { etiquetas: Etiqueta[]; textos: Textos }) {
  // "Vegano" ya incluye "vegetariano": se muestra solo el más específico.
  const visibles = etiquetas.includes('vegano') ? etiquetas.filter((e) => e !== 'vegetariano') : etiquetas;
  if (!visibles.length) return null;
  return <View style={styles.fila}>{visibles.map((e) => <EtiquetaPill key={e} etiqueta={e} textos={textos} />)}</View>;
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
});
