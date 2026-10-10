import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { Easing, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2 } from 'lucide-react-native';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space } from './tokens';

export interface ToastProps {
  message: string | null;
  onHide: () => void;
  /** Milisegundos hasta que desaparece solo. */
  duration?: number;
  /** Separación extra desde arriba (pantallas con barra flotante propia). */
  offset?: number;
}

/** Confirmación breve y flotante (no bloquea, se anuncia a lectores de pantalla y se retira sola). */
export function Toast({ message, onHide, duration = 2600, offset = 0 }: ToastProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // El temporizador depende solo del mensaje: un onHide nuevo en cada render no lo reinicia.
  const alOcultar = useRef(onHide);
  alOcultar.current = onHide;
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => alOcultar.current(), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + space.md + offset }]}>
      <Animated.View
        entering={FadeInUp.duration(260).easing(Easing.bezier(0.23, 1, 0.32, 1))}
        exiting={FadeOutUp.duration(180)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.pill, { borderColor: colors.separator }]}
      >
        <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, opacity: 0.6 }]} />
        <CheckCircle2 size={20} color={colors.tint} />
        <Text variant="subhead" weight="600">{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.xl, borderRadius: radius.pill, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 8px 28px rgba(0,0,0,0.16)' },
});
