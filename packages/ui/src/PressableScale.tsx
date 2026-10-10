import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { haptic } from './haptics';
import { motion } from './tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  /** Vibración al confirmar el toque (una sola, junto al cambio visual). */
  feedback?: 'ligero' | 'medio' | 'seleccion' | false;
}

/**
 * Feedback físico: se achica al apoyar el dedo (no al soltar) y vuelve con ease-out.
 * Con "reducir movimiento" solo cambia la opacidad.
 */
export function PressableScale({ scaleTo = 0.97, feedback = false, style, onPressIn, onPressOut, onPress, disabled, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: reduced ? [] : [{ scale: 1 - (1 - scaleTo) * pressed.get() }],
    opacity: reduced ? 1 - 0.25 * pressed.get() : 1,
  }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: !!disabled, ...(rest.accessibilityState ?? {}) }}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      onPressIn={(event) => { pressed.set(withTiming(1, { duration: motion.pressMs, easing: EASE_OUT })); onPressIn?.(event); }}
      onPressOut={(event) => { pressed.set(withTiming(0, { duration: motion.pressMs, easing: EASE_OUT })); onPressOut?.(event); }}
      onPress={(event) => { if (feedback) haptic[feedback](); onPress?.(event); }}
      style={[style, animated]}
    />
  );
}
