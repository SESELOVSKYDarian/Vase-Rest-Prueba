import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Image as SvgImage, Line, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Plano } from '@vase/domain';
import type { PlanoMaterial } from '@vase/ui';

/** Cuánto se extiende la grilla de plano alrededor del local (cm). */
export const MARGEN_GRILLA = 600;
const MURO = 16;

/**
 * Piso del local. Estilo arquitectónico: hoja azul con grilla de líneas que sigue más allá del
 * local, líneas de construcción en los ejes de muros y ambientes, y el muro perimetral claro.
 * Estilo claro: piso con grilla de puntos y borde redondeado.
 */
export function PisoPlano({ plano, material: m, fondoUrl }: { plano: Plano; material: PlanoMaterial; fondoUrl: string | null }) {
  const { ancho, alto } = plano;
  const imagen = fondoUrl ? <SvgImage href={{ uri: fondoUrl }} x={0} y={0} width={ancho} height={alto} preserveAspectRatio="xMidYMid meet" opacity={plano.fondo?.opacidad ?? 0.5} /> : null;

  if (!m.arquitectonico) {
    return (
      <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="grilla" x={0} y={0} width={50} height={50} patternUnits="userSpaceOnUse">
            <Circle cx={25} cy={25} r={1.8} fill={m.grilla} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={ancho} height={alto} rx={32} ry={32} fill={m.piso} />
        <Rect x={0} y={0} width={ancho} height={alto} rx={32} ry={32} fill="url(#grilla)" />
        {imagen}
        <Rect x={3} y={3} width={ancho - 6} height={alto - 6} rx={30} ry={30} fill="none" stroke={m.borde} strokeWidth={6} />
      </Svg>
    );
  }

  const M = MARGEN_GRILLA;
  const W = ancho + M * 2;
  const H = alto + M * 2;
  // Ejes de construcción: bordes del local y de cada ambiente, extendidos de punta a punta.
  const ejesX = new Set<number>([0, ancho]);
  const ejesY = new Set<number>([0, alto]);
  plano.zonas.forEach((z) => { ejesX.add(z.x); ejesX.add(z.x + z.w); ejesY.add(z.y); ejesY.add(z.y + z.h); });

  return (
    <Svg width={W} height={H} viewBox={`${-M} ${-M} ${W} ${H}`} style={{ position: 'absolute', left: -M, top: -M }}>
      <Defs>
        <Pattern id="fina" x={0} y={0} width={50} height={50} patternUnits="userSpaceOnUse">
          <Path d="M 50 0 L 0 0 0 50" fill="none" stroke={m.grilla} strokeWidth={1.2} />
        </Pattern>
        <Pattern id="gruesa" x={0} y={0} width={250} height={250} patternUnits="userSpaceOnUse">
          <Path d="M 250 0 L 0 0 0 250" fill="none" stroke={m.grilla} strokeWidth={2.4} />
        </Pattern>
        {/* La hoja se funde con el fondo hacia los bordes. */}
        <RadialGradient id="vineta" cx="50%" cy="50%" r="62%">
          <Stop offset="0.62" stopColor={m.fondo} stopOpacity={0} />
          <Stop offset="1" stopColor={m.fondo} stopOpacity={1} />
        </RadialGradient>
      </Defs>
      <Rect x={-M} y={-M} width={W} height={H} fill={m.fondo} />
      <Rect x={-M} y={-M} width={W} height={H} fill="url(#fina)" />
      <Rect x={-M} y={-M} width={W} height={H} fill="url(#gruesa)" />
      <G>
        {[...ejesX].map((x) => <Line key={`x${x}`} x1={x} y1={-M} x2={x} y2={alto + M} stroke={m.guia} strokeWidth={1.5} />)}
        {[...ejesY].map((y) => <Line key={`y${y}`} x1={-M} y1={y} x2={ancho + M} y2={y} stroke={m.guia} strokeWidth={1.5} />)}
      </G>
      <Rect x={-M} y={-M} width={W} height={H} fill="url(#vineta)" />
      {/* Sombra del edificio, piso y muro perimetral. */}
      <Rect x={-6} y={4} width={ancho + 12} height={alto + 12} fill="#000" fillOpacity={0.28} />
      <Rect x={0} y={0} width={ancho} height={alto} fill={m.piso} />
      {imagen}
      <Rect x={MURO / 2} y={MURO / 2} width={ancho - MURO} height={alto - MURO} fill="none" stroke={m.muro} strokeWidth={MURO} />
      <Rect x={MURO / 2} y={MURO / 2} width={ancho - MURO} height={alto - MURO} fill="none" stroke={m.muroLinea} strokeWidth={1.5} />
    </Svg>
  );
}
