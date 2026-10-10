import { useLayoutEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@vase/ui';

interface Props {
  /** Esquina superior izquierda y medida actual (cm). */
  left: number;
  top: number;
  w: number;
  h: number;
  escala: SharedValue<number>;
  lienzo?: GestureType;
  onFin: (dw: number, dh: number) => void;
}

/**
 * Manija para estirar una zona u objeto desde la esquina inferior derecha. Muestra un contorno
 * punteado mientras se arrastra y aplica la medida (con imán de 10 cm) recién al soltar.
 */
export function ManijaTamano({ left, top, w, h, escala, lienzo, onFin }: Props) {
  const { colors } = useTheme();
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const activa = useSharedValue(0);
  useLayoutEffect(() => { dx.set(0); dy.set(0); }, [w, h, dx, dy]);

  const soltar = (ancho: number, alto: number) => {
    onFin(ancho, alto);
    // Si la medida no cambió (tope mínimo), la manija vuelve a su lugar igual.
    setTimeout(() => { dx.set(withTiming(0, { duration: 140 })); dy.set(withTiming(0, { duration: 140 })); }, 0);
  };

  let pan = Gesture.Pan()
    .minDistance(2)
    .onBegin(() => { activa.set(withTiming(1, { duration: 120 })); })
    .onUpdate((e) => { dx.set(e.translationX / escala.get()); dy.set(e.translationY / escala.get()); })
    .onEnd(() => { scheduleOnRN(soltar, dx.get(), dy.get()); })
    .onFinalize(() => { activa.set(withTiming(0, { duration: 160 })); });
  if (lienzo) pan = pan.blocksExternalGesture(lienzo);

  // Contorno: toma la medida nueva mientras se arrastra.
  const contorno = useAnimatedStyle(() => ({ width: Math.max(10, w + dx.get()), height: Math.max(10, h + dy.get()), opacity: activa.get() }));
  // La manija mantiene ~44 px en pantalla sea cual sea el zoom.
  const manija = useAnimatedStyle(() => {
    const lado = 44 / escala.get();
    return { width: lado, height: lado, borderRadius: lado / 2, left: w + dx.get() - lado / 2, top: h + dy.get() - lado / 2, borderWidth: 3 / escala.get() };
  });

  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left, top, width: 1, height: 1, zIndex: 30 }}>
      <Animated.View pointerEvents="none" style={[styles.contorno, { borderColor: colors.tint, borderWidth: 3 }, contorno]} />
      <GestureDetector gesture={pan}>
        <Animated.View accessible accessibilityRole="adjustable" accessibilityLabel="Estirar" style={[styles.manija, { backgroundColor: colors.tint, borderColor: colors.surface }, manija]} />
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contorno: { position: 'absolute', left: 0, top: 0, borderStyle: 'dashed', borderRadius: 4 },
  manija: { position: 'absolute', boxShadow: '0 2px 10px rgba(0,0,0,0.35)' },
});
