import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { Easing, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatearARS } from '@vase/domain';
import { Button, Text, radius, space, useTheme } from '@vase/ui';

interface Props {
  unidades: number;
  total: number;
  enviando: boolean;
  onEnviar: () => void;
}

/** Barra fija de acción: aparece cuando hay algo para enviar y muestra qué se va a mandar. */
export function CartBar({ unidades, total, enviando, onEnviar }: Props) {
  const { colors, sizeClass } = useTheme();
  const insets = useSafeAreaInsets();
  const compact = sizeClass === 'compact';
  return (
    <Animated.View
      entering={FadeInDown.duration(260).easing(Easing.bezier(0.23, 1, 0.32, 1))}
      exiting={FadeOutDown.duration(160)}
      style={[styles.wrap, { bottom: compact ? insets.bottom + 68 : insets.bottom + space.xl }, !compact && styles.wrapWide]}
      pointerEvents="box-none"
    >
      <View style={[styles.bar, { borderColor: colors.separator }]}>
        <BlurView intensity={70} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, opacity: 0.55 }]} />
        <View style={styles.info}>
          <Text variant="footnote" color="secondary">{unidades} {unidades === 1 ? 'ítem' : 'ítems'}</Text>
          <Text variant="title3" numeric weight="700">{formatearARS(total, true)}</Text>
        </View>
        <Button label="Enviar a cocina" loading={enviando} onPress={onEnviar} style={styles.boton} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  wrapWide: { left: 0, right: 0 },
  bar: { width: '100%', maxWidth: 560, flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.md, paddingLeft: space.xl, borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderCurve: 'continuous', boxShadow: '0 8px 30px rgba(0,0,0,0.14)' },
  info: { flex: 1 },
  boton: { paddingHorizontal: space.xl },
});
