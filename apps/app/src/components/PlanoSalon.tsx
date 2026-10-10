import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { Users } from 'lucide-react-native';
import { ESTADOS_CON_PERSONAS, type EstadoMesa, type Mesa } from '@vase/domain';
import { PressableScale, Text, haptic, radius, space, useEstadoColor, useTheme } from '@vase/ui';

// Tamaños lógicos de cada forma: los mismos que usa el editor del plano en el panel web.
const TAMANO = { circular: { w: 92, h: 92 }, cuadrada: { w: 92, h: 92 }, rectangular: { w: 124, h: 78 } } as const;
const MARGEN = 64;

interface Props {
  mesas: Mesa[];
  seleccionada?: string | null;
  /** Mesas atenuadas por el filtro activo. */
  visibles?: ReadonlySet<string> | null;
  onSeleccionar: (mesa: Mesa) => void;
}

type Puesta = { mesa: Mesa; x: number; y: number };

const limitesDe = (puestas: Puesta[]) => {
  const xs = puestas.map((p) => p.x);
  const ys = puestas.map((p) => p.y);
  const minX = Math.min(...xs) - MARGEN;
  const minY = Math.min(...ys) - MARGEN;
  return { minX, minY, w: Math.max(...xs) + MARGEN - minX, h: Math.max(...ys) + MARGEN - minY };
};

/** Posiciones guardadas en el plano; null si no hay ninguna (todas en 0). */
function posicionesGuardadas(mesas: Mesa[]): Puesta[] | null {
  if (mesas.every((m) => m.posicion.x === 0 && m.posicion.y === 0)) return null;
  return mesas.map((mesa) => ({ mesa, x: mesa.posicion.x, y: mesa.posicion.y }));
}

function enGrilla(mesas: Mesa[], columnas: number): Puesta[] {
  return [...mesas].sort((a, b) => a.numero - b.numero).map((mesa, i) => ({ mesa, x: 140 + (i % columnas) * 160, y: 120 + Math.floor(i / columnas) * 150 }));
}

export function PlanoSalon({ mesas, seleccionada, visibles, onSeleccionar }: Props) {
  const { colors } = useTheme();
  const colorDe = useEstadoColor();
  const [ancho, setAncho] = useState(0);
  /**
   * Se respeta el plano guardado solo si entra con mesas de tamaño cómodo (escala ≥ 0,6); si no
   * (celular, tablet angosta) se acomoda en grilla: mejor tocar mesas grandes que ver el plano diminuto.
   */
  const { puestas, limites, escala } = useMemo(() => {
    const guardadas = posicionesGuardadas(mesas);
    if (guardadas && ancho > 0) {
      const lim = limitesDe(guardadas);
      const esc = ancho / lim.w;
      if (esc >= 0.6) return { puestas: guardadas, limites: lim, escala: Math.min(1.15, esc) };
    }
    const columnas = Math.max(3, Math.min(6, Math.floor((ancho || 360) / 150)));
    const grilla = enGrilla(mesas, columnas);
    const lim = limitesDe(grilla);
    return { puestas: grilla, limites: lim, escala: ancho > 0 ? Math.min(1.15, Math.max(0.5, ancho / lim.w)) : 1 };
  }, [mesas, ancho]);
  const contenidoW = limites.w * escala;
  const contenidoH = limites.h * escala;

  const onLayout = (e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={[styles.marco, { backgroundColor: colors.surface }]}>
      {ancho > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={contenidoW > ancho} contentContainerStyle={{ width: Math.max(ancho, contenidoW), height: contenidoH, alignItems: 'center' }}>
          <View style={{ width: contenidoW, height: contenidoH }}>
            {puestas.map(({ mesa, x, y }, i) => {
              const t = TAMANO[mesa.forma];
              const w = t.w * escala;
              const h = t.h * escala;
              const color = colorDe(mesa.estado);
              const activa = seleccionada === mesa.id;
              const atenuada = visibles ? !visibles.has(mesa.id) : false;
              return (
                <Animated.View
                  key={mesa.id}
                  entering={FadeIn.delay(Math.min(i, 12) * 30).duration(260).easing(Easing.bezier(0.23, 1, 0.32, 1))}
                  style={{ position: 'absolute', left: (x - limites.minX) * escala - w / 2, top: (y - limites.minY) * escala - h / 2, width: w, height: h, opacity: atenuada ? 0.28 : 1 }}
                >
                  <PressableScale
                    onPress={() => { haptic.ligero(); onSeleccionar(mesa); }}
                    scaleTo={0.94}
                    accessibilityLabel={`Mesa ${mesa.numero}, ${etiqueta(mesa.estado)}, ${mesa.capacidad} lugares`}
                    style={{ width: w, height: h }}
                  >
                    {/* El color de estado cambia con transición CSS de Reanimated (borde y fondo), sin re-render por frame. */}
                    <Animated.View
                      style={[
                        styles.mesa,
                        {
                          width: w,
                          height: h,
                          borderRadius: mesa.forma === 'circular' ? h / 2 : mesa.forma === 'cuadrada' ? radius.md : radius.lg,
                          borderColor: color,
                          backgroundColor: ESTADOS_CON_PERSONAS.has(mesa.estado) ? color + (activa ? '40' : '26') : colors.surface,
                          transitionProperty: ['borderColor', 'backgroundColor'],
                          transitionDuration: 300,
                          boxShadow: activa ? `0 0 0 4px ${color}33` : undefined,
                        },
                      ]}
                    >
                      <Text variant="title2" numeric weight="700" style={{ fontSize: 22 * Math.min(1, escala + 0.15) }}>{mesa.numero}</Text>
                      <View style={styles.cap}>
                        <Users size={11} color={colors.labelSecondary} strokeWidth={2.4} />
                        <Text variant="caption" color="secondary" numeric>
                          {ESTADOS_CON_PERSONAS.has(mesa.estado) && mesa.personas ? `${mesa.personas}/${mesa.capacidad}` : mesa.capacidad}
                        </Text>
                      </View>
                    </Animated.View>
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function etiqueta(estado: EstadoMesa) {
  return { libre: 'libre', ocupada: 'ocupada', esperando_pedido: 'esperando pedido', pedido_listo: 'pedido listo', esperando_pago: 'esperando pago', para_cobrar: 'para cobrar', problema: 'con problema' }[estado];
}

const styles = StyleSheet.create({
  marco: { borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous', paddingVertical: space.sm, minHeight: 200 },
  mesa: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderCurve: 'continuous', gap: 1 },
  cap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
