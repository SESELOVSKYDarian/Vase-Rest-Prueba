import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { NivelAlerta } from '@vase/domain';
import { Text, useTheme } from '@vase/ui';

/**
 * Anillo que late alrededor de una mesa demorada. Urgente late rápido y en rojo; atención, lento y
 * en ámbar. Con "reducir movimiento" queda un anillo fijo: la información no depende de la animación.
 */
export function PulsoMesa({ lado, diametro, nivel }: { lado: number; diametro: number; nivel: Exclude<NivelAlerta, 'ok'> }) {
  const { colors } = useTheme();
  const reducido = useReducedMotion();
  const fase = useSharedValue(0);
  const color = nivel === 'urgente' ? colors.danger : colors.warning;
  useEffect(() => {
    if (reducido) { fase.set(0); return; }
    fase.set(0);
    fase.set(withRepeat(withTiming(1, { duration: nivel === 'urgente' ? 900 : 1700, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(fase);
  }, [nivel, reducido, fase]);
  const onda = useAnimatedStyle(() => ({ opacity: reducido ? 0 : 0.55 * (1 - fase.get()), transform: [{ scale: 0.92 + fase.get() * 0.42 }] }));
  const base = (diametro - lado) / 2;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { left: -base, top: -base, width: diametro, height: diametro, alignItems: 'center', justifyContent: 'center' }]}>
      <View style={{ position: 'absolute', width: diametro * 0.8, height: diametro * 0.8, borderRadius: diametro, borderWidth: 6, borderColor: color, opacity: 0.9 }} />
      <Animated.View style={[{ position: 'absolute', width: diametro * 0.8, height: diametro * 0.8, borderRadius: diametro, backgroundColor: color }, onda]} />
    </View>
  );
}

/** Mancha de color bajo la mesa para el mapa de calor, con el valor al lado. */
export function CalorBajoMesa({ lado, intensidad, etiqueta, color }: { lado: number; intensidad: number; etiqueta: string; color: string }) {
  const { colors } = useTheme();
  const d = lado * 1.1;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={{ width: d, height: d, borderRadius: d, backgroundColor: color, opacity: 0.18 + 0.52 * intensidad }} />
      <View style={{ position: 'absolute', bottom: lado * 0.08, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 40, backgroundColor: colors.surface2 }}>
        <Text variant="subhead" weight="700" numeric style={{ fontSize: 28, lineHeight: 34 }}>{etiqueta}</Text>
      </View>
    </View>
  );
}

/** Iniciales del mozo que atiende la mesa. */
export function InsigniaMozo({ texto, lado }: { texto: string; lado: number }) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', right: lado * 0.04, top: lado * 0.04, minWidth: 56, height: 56, paddingHorizontal: 8, borderRadius: 28, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="footnote" weight="700" style={{ color: colors.onTint, fontSize: 26, lineHeight: 30 }}>{texto}</Text>
    </View>
  );
}
