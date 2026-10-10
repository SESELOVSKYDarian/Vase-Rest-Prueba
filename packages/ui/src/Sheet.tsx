import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from './haptics';
import { Text } from './Text';
import { useTheme } from './theme';
import { motion, radius, space } from './tokens';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Acción principal fija abajo (un solo botón "filled"). */
  footer?: ReactNode;
}

/**
 * Hoja modal: en celular sube desde abajo y se arrastra para cerrar (por velocidad o distancia);
 * en tablet/escritorio es un panel centrado. Cierra también con el fondo, Escape y el botón atrás.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const { colors, sizeClass } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0); // 0 cerrado → 1 abierto
  const drag = useSharedValue(0);
  const compact = sizeClass === 'compact';

  useEffect(() => {
    if (open) {
      setMounted(true);
      drag.set(0);
      progress.set(reduced ? withTiming(1, { duration: 120 }) : withSpring(1, motion.sheet));
    } else if (mounted) {
      progress.set(withTiming(0, { duration: 220, easing: EASE_OUT }, (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = () => { haptic.ligero(); onClose(); };

  const pan = Gesture.Pan()
    .enabled(compact)
    .onUpdate((event) => { drag.set(Math.max(0, event.translationY)); })
    .onEnd((event) => {
      if (event.velocityY > 700 || event.translationY > 120) {
        scheduleOnRN(dismiss);
      } else {
        drag.set(withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: event.velocityY }));
      }
    });

  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 1], [0, 1]) * (1 - Math.min(1, drag.get() / 400)) }));
  const panel = useAnimatedStyle(() => {
    const enter = (1 - progress.get());
    return compact
      ? { transform: [{ translateY: enter * windowHeight * 0.5 + drag.get() }], opacity: interpolate(progress.get(), [0, 0.4, 1], [0, 1, 1]) }
      : { transform: [{ scale: 0.96 + 0.04 * progress.get() }], opacity: progress.get() };
  });

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Cerrar" accessibilityRole="button" />
        </Animated.View>
        <View style={[styles.anchor, compact ? styles.bottom : styles.center]} pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.panel,
              compact ? { width: '100%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: insets.bottom + space.lg } : { width: 520, borderRadius: radius.sheet, paddingTop: space.md, paddingBottom: space.xl },
              { backgroundColor: colors.surface2, maxHeight: windowHeight * 0.9 },
              panel,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={styles.header}>
                {compact ? <View style={[styles.grabber, { backgroundColor: colors.labelTertiary }]} /> : null}
                {title ? <Text variant="title3" align="center" accessibilityRole="header">{title}</Text> : null}
              </View>
            </GestureDetector>
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  anchor: { flex: 1, alignItems: 'center' },
  bottom: { justifyContent: 'flex-end' },
  center: { justifyContent: 'center' },
  panel: { overflow: 'hidden', borderCurve: 'continuous', boxShadow: '0 -4px 40px rgba(0,0,0,0.18)' },
  header: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md, paddingHorizontal: space.xl, gap: space.md, minHeight: 28 },
  grabber: { width: 36, height: 5, borderRadius: 3, opacity: 0.5 },
  body: { paddingHorizontal: space.xl, flexShrink: 1 },
  footer: { paddingHorizontal: space.xl, paddingTop: space.lg },
});
