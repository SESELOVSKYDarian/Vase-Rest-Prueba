import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space } from './tokens';

/** Estado vacío: dice qué pasó y qué hacer ahora. */
export function EmptyState({ icon, title, message, action }: { icon: ReactNode; title: string; message?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(260).easing(Easing.bezier(0.23, 1, 0.32, 1))} style={styles.empty}>
      <View style={[styles.iconWrap, { backgroundColor: colors.fillSoft }]}>{icon}</View>
      <Text variant="title3" align="center">{title}</Text>
      {message ? <Text variant="callout" color="secondary" align="center" style={styles.message}>{message}</Text> : null}
      {action}
    </Animated.View>
  );
}

/** Bloque que "respira" mientras carga: mantiene la forma del contenido final. */
export function Skeleton({ height = 20, width = '100%', rounded = radius.sm }: { height?: number; width?: number | `${number}%`; rounded?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    if (!reduced) pulse.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduced, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return <Animated.View style={[{ height, width, borderRadius: rounded, backgroundColor: colors.fill }, style]} />;
}

export function ErrorBanner({ message, action }: { message: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.error, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
      <Text variant="subhead" color="danger" style={{ flex: 1 }}>{message}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space['5xl'], paddingHorizontal: space.xl },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  message: { maxWidth: 320 },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, borderCurve: 'continuous' },
});
