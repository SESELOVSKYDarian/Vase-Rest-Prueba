import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from './haptics';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';
import { motion, radius } from './tokens';

export interface SegmentedProps<T extends string> {
  items: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/** Control segmentado: la "píldora" se desliza (transform) hasta la opción elegida. */
export function Segmented<T extends string>({ items, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.findIndex((item) => item.value === value));
  const segment = width > 0 ? (width - 4) / items.length : 0;
  const x = useSharedValue(index * segment);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth(next);
    x.set(index * ((next - 4) / items.length));
  };

  // Si el valor cambia desde afuera (no por un toque), la píldora igual acompaña.
  useEffect(() => { if (segment > 0) x.set(reduced ? index * segment : withSpring(index * segment, motion.sheet)); }, [index, segment, reduced, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={[styles.track, { backgroundColor: colors.fill }]}
    >
      {width > 0 ? (
        <Animated.View style={[styles.thumb, { width: segment, backgroundColor: colors.surface2 }, thumb]} />
      ) : null}
      {items.map((item, i) => (
        <PressableScale
          key={item.value}
          scaleTo={0.98}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.value === value }}
          style={styles.item}
          onPress={() => {
            if (item.value === value) return;
            haptic.seleccion();
            x.set(reduced ? i * segment : withSpring(i * segment, motion.sheet));
            onChange(item.value);
          }}
        >
          <Text variant="subhead" weight={item.value === value ? '600' : '500'} color={item.value === value ? 'label' : 'secondary'} numberOfLines={1}>
            {item.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 2, borderRadius: radius.sm + 2, borderCurve: 'continuous', minHeight: 40 },
  thumb: { position: 'absolute', top: 2, bottom: 2, left: 2, borderRadius: radius.sm, borderCurve: 'continuous', boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 0 1px rgba(0,0,0,0.12)' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
