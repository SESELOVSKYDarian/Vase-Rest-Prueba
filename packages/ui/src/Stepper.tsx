import { StyleSheet, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { haptic } from './haptics';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';
import { minTarget, radius } from './tokens';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}

/** Cantidad con − y +: cada botón es tocable de 48 pt aunque el dibujo sea chico. */
export function Stepper({ value, onChange, min = 0, max = 99, label }: StepperProps) {
  const { colors } = useTheme();
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next === value) return;
    haptic.seleccion();
    onChange(next);
  };
  return (
    <View style={[styles.wrap, { backgroundColor: colors.fill }]} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ now: value, min, max }}>
      <PressableScale onPress={() => step(-1)} disabled={value <= min} accessibilityLabel={`Quitar uno de ${label}`} style={[styles.btn, value <= min && styles.off]} scaleTo={0.9}>
        <Minus size={18} color={colors.label} strokeWidth={2.4} />
      </PressableScale>
      <Text variant="headline" numeric align="center" style={styles.value}>{value}</Text>
      <PressableScale onPress={() => step(1)} disabled={value >= max} accessibilityLabel={`Agregar uno de ${label}`} style={[styles.btn, value >= max && styles.off]} scaleTo={0.9}>
        <Plus size={18} color={colors.label} strokeWidth={2.4} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill },
  btn: { width: minTarget - 4, height: minTarget - 4, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.3 },
  value: { minWidth: 28 },
});
