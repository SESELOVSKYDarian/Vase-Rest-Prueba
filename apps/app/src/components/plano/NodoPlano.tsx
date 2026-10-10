import { useLayoutEffect, type ReactNode } from 'react';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { haptic } from '@vase/ui';

interface Props {
  /** Esquina superior izquierda y tamaño del cuadro, en cm del plano. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Escala actual del lienzo (pantalla / cm): convierte el arrastre del dedo a cm. */
  escala: SharedValue<number>;
  arrastrable: boolean;
  /** Gesto del lienzo que debe esperar mientras se arrastra este objeto. */
  lienzo?: GestureType;
  onTocar?: () => void;
  onSoltar?: (dx: number, dy: number) => void;
  accessibilityLabel?: string;
  children: ReactNode;
}

/**
 * Objeto del plano (mesa, zona o elemento). En edición se arrastra con el dedo o el mouse; el
 * movimiento corre en el hilo de UI y recién al soltar se avisa a React (una vez, no por cuadro).
 */
export function NodoPlano({ left, top, width, height, escala, arrastrable, lienzo, onTocar, onSoltar, accessibilityLabel, children }: Props) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const alzado = useSharedValue(0);

  // Cuando la nueva posición llega desde el estado, el desplazamiento provisional vuelve a 0
  // en el mismo cuadro: así no hay salto al soltar.
  useLayoutEffect(() => {
    dx.set(0);
    dy.set(0);
  }, [left, top, dx, dy]);

  const tocar = () => { onTocar?.(); };
  const soltar = (x: number, y: number) => { haptic.ligero(); onSoltar?.(x, y); };

  let pan = Gesture.Pan()
    .enabled(arrastrable)
    .minDistance(3)
    .onStart(() => {
      alzado.set(withTiming(1, { duration: 120 }));
      scheduleOnRN(tocar);
    })
    .onUpdate((e) => {
      const s = escala.get() || 1;
      dx.set(e.translationX / s);
      dy.set(e.translationY / s);
    })
    .onEnd(() => {
      alzado.set(withTiming(0, { duration: 160 }));
      scheduleOnRN(soltar, dx.get(), dy.get());
    });
  if (lienzo) pan = pan.blocksExternalGesture(lienzo);

  const tap = Gesture.Tap().maxDuration(400).onEnd(() => { scheduleOnRN(tocar); });
  // Si no se puede arrastrar (servicio), el toque va solo: un pan deshabilitado no debe frenarlo.
  const gesto = arrastrable ? Gesture.Exclusive(pan, tap) : tap;

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.get() }, { translateY: dy.get() }, { scale: 1 + alzado.get() * 0.04 }],
    zIndex: alzado.get() > 0 ? 10 : 1,
  }));

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[{ position: 'absolute', left, top, width, height }, estilo]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
