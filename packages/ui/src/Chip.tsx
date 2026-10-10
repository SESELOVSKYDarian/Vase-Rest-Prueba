import { StyleSheet } from 'react-native';
import { haptic } from './haptics';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space } from './tokens';

export interface ChipProps {
  label: string;
  count?: number;
  selected?: boolean;
  onPress?: () => void;
}

/** Filtro en píldora. Seleccionado = fondo de acento; el contador mantiene ancho fijo. */
export function Chip({ label, count, selected, onPress }: ChipProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={() => { haptic.seleccion(); onPress?.(); }}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      style={[styles.chip, { backgroundColor: selected ? colors.tint : colors.fill }]}
    >
      <Text variant="subhead" weight="600" color={selected ? 'onTint' : 'label'} numberOfLines={1}>{label}</Text>
      {count !== undefined ? (
        <Text variant="caption" weight="600" numeric color={selected ? 'onTint' : 'secondary'} style={selected ? styles.countOn : undefined}>{count}</Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  countOn: { opacity: 0.85 },
});
