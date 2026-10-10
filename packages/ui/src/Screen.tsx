import type { ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from './theme';
import { space } from './tokens';

const BAR = 52;

export interface ScreenProps {
  title: string;
  subtitle?: string;
  /** Acciones a la derecha del título (iconos o un botón chico). */
  headerRight?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Ancho máximo del contenido en pantallas grandes. */
  maxWidth?: number;
  /** Espacio al final para que la barra inferior no tape el último elemento. */
  bottomInset?: number;
}

/**
 * Pantalla con título grande que se compacta al desplazar (como las apps de Apple).
 * La barra compacta se funde con opacidad sobre un blur estático (nunca se anima la intensidad).
 */
export function Screen({ title, subtitle, headerRight, children, refreshing, onRefresh, maxWidth = 960, bottomInset = 0 }: ScreenProps) {
  const { colors, sizeClass } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { scrollY.set(event.contentOffset.y); });

  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [24, 56], [0, 1], Extrapolation.CLAMP) }));
  const compactTitle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [36, 64], [0, 1], Extrapolation.CLAMP) }));

  const gutter = sizeClass === 'compact' ? space.xl : sizeClass === 'medium' ? space['3xl'] : space['4xl'];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.tint} /> : undefined}
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space['5xl'] + bottomInset, paddingHorizontal: gutter, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth, gap: space['3xl'] }}>
          <View style={[styles.titleRow, { paddingTop: BAR - space.sm }]}>
            <View style={styles.titleText}>
              <Text variant="largeTitle" accessibilityRole="header">{title}</Text>
              {subtitle ? <Text variant="callout" color="secondary" style={{ marginTop: space.xs }}>{subtitle}</Text> : null}
            </View>
            {headerRight ? <View style={styles.right}>{headerRight}</View> : null}
          </View>
          {children}
        </View>
      </Animated.ScrollView>

      <Animated.View pointerEvents="none" style={[styles.bar, { height: insets.top + BAR }, barStyle]}>
        <BlurView intensity={40} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[styles.hairline, { backgroundColor: colors.separator }]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.compact, { top: insets.top, height: BAR }, compactTitle]}>
        <Text variant="headline" numberOfLines={1}>{title}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.lg },
  titleText: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: 4 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  hairline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  compact: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
});
