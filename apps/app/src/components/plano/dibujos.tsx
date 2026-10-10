import { Platform } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { ETIQUETA_ELEMENTO, MEDIDA_SILLA, posicionesSillas, type ElementoPlano, type MesaEnPlano, type ZonaPlano } from '@vase/domain';
import type { PlanoMaterial } from '@vase/ui';

/** Familia tipográfica para textos SVG (en iOS la del sistema; en el resto, Inter ya cargada). */
export const fuenteSvg = (peso: '600' | '700') =>
  Platform.OS === 'ios' ? undefined : Platform.OS === 'web' ? `-apple-system, BlinkMacSystemFont, Inter, 'Segoe UI', sans-serif` : peso === '700' ? 'Inter_700Bold' : 'Inter_600SemiBold';

/** Espacio que ocupan las sillas alrededor de la mesa (cm). */
export const MARGEN_SILLAS = MEDIDA_SILLA.separacion + MEDIDA_SILLA.h + 6;

/** Lado del cuadro que contiene la mesa con sus sillas, para cualquier rotación. */
export const ladoMesa = (m: Pick<MesaEnPlano, 'ancho' | 'alto'>) => Math.ceil(Math.hypot(m.ancho, m.alto) + MARGEN_SILLAS * 2);

interface MesaSvgProps {
  mesa: MesaEnPlano;
  material: PlanoMaterial;
  numero: string;
  detalle?: string;
  /** Color del estado (servicio) o null en edición. */
  colorEstado: string | null;
  /** Mesa con gente: la superficie toma un tinte del estado. */
  ocupada?: boolean;
  seleccionada?: boolean;
  colorSeleccion: string;
  colorTexto: string;
  colorTextoSecundario: string;
}

export function MesaSvg({ mesa, material, numero, detalle, colorEstado, ocupada, seleccionada, colorSeleccion, colorTexto, colorTextoSecundario }: MesaSvgProps) {
  const L = ladoMesa(mesa);
  const c = L / 2;
  const sillas = posicionesSillas(mesa);
  const borde = seleccionada ? colorSeleccion : colorEstado ?? material.borde;
  const grosor = seleccionada || colorEstado ? 4 : 2;
  const radio = mesa.forma === 'cuadrada' ? 12 : 16;
  const tapa = (dy: number, fill: string, stroke?: string, sw = 0, opacidad = 1) =>
    mesa.forma === 'circular' ? (
      <Circle cx={c} cy={c + dy} r={mesa.ancho / 2} fill={fill} fillOpacity={opacidad} stroke={stroke} strokeWidth={sw} />
    ) : (
      <Rect x={c - mesa.ancho / 2} y={c - mesa.alto / 2 + dy} width={mesa.ancho} height={mesa.alto} rx={radio} ry={radio} fill={fill} fillOpacity={opacidad} stroke={stroke} strokeWidth={sw} />
    );
  return (
    <Svg width={L} height={L} viewBox={`0 0 ${L} ${L}`}>
      <G transform={`rotate(${mesa.rot} ${c} ${c})`}>
        {sillas.map((s, i) => (
          <G key={i} transform={`translate(${c + s.x} ${c + s.y}) rotate(${s.rot})`}>
            <Rect x={-MEDIDA_SILLA.w / 2} y={-MEDIDA_SILLA.h / 2 + 2} width={MEDIDA_SILLA.w} height={MEDIDA_SILLA.h} rx={11} ry={11} fill={material.sombra} />
            <Rect x={-MEDIDA_SILLA.w / 2} y={-MEDIDA_SILLA.h / 2} width={MEDIDA_SILLA.w} height={MEDIDA_SILLA.h} rx={11} ry={11} fill={material.silla} stroke={material.sillaBorde} strokeWidth={1.5} />
            <Rect x={-MEDIDA_SILLA.w / 2 + 4} y={-MEDIDA_SILLA.h / 2 + 3} width={MEDIDA_SILLA.w - 8} height={9} rx={4.5} ry={4.5} fill={material.respaldo} />
          </G>
        ))}
        {tapa(5, material.sombra)}
        {tapa(0, material.mesa, borde, grosor)}
        {/* Tinte suave del estado sobre la tapa: la mesa con gente se lee de lejos. */}
        {ocupada && colorEstado ? tapa(0, colorEstado, colorEstado, grosor, 0.16) : null}
      </G>
      <SvgText x={c} y={detalle ? c + 4 : c + 10} fontSize={30} fontWeight="700" fontFamily={fuenteSvg('700')} fill={colorTexto} textAnchor="middle">
        {numero}
      </SvgText>
      {detalle ? (
        <SvgText x={c} y={c + 28} fontSize={16} fontWeight="600" fontFamily={fuenteSvg('600')} fill={colorTextoSecundario} textAnchor="middle">
          {detalle}
        </SvgText>
      ) : null}
    </Svg>
  );
}

/** Lado del cuadro que contiene un elemento rotado (las puertas necesitan lugar para el barrido). */
export const ladoElemento = (e: Pick<ElementoPlano, 'tipo' | 'w' | 'h'>) => {
  const alto = e.tipo === 'puerta' ? Math.max(e.h, e.w) * 2 : e.h;
  return Math.ceil(Math.hypot(e.w, alto) + 8);
};

export function ElementoSvg({ elemento, material, colorTexto, seleccionado, colorSeleccion }: { elemento: ElementoPlano; material: PlanoMaterial; colorTexto: string; seleccionado?: boolean; colorSeleccion: string }) {
  const L = ladoElemento(elemento);
  const c = L / 2;
  const { w, h } = elemento;
  const x0 = c - w / 2;
  const y0 = c - h / 2;
  const etiqueta = elemento.etiqueta || ETIQUETA_ELEMENTO[elemento.tipo];
  const tamTexto = Math.max(14, Math.min(26, h * 0.32, w / Math.max(4, etiqueta.length) * 1.6));
  let cuerpo: React.ReactNode;
  switch (elemento.tipo) {
    case 'barra':
    case 'caja':
      cuerpo = (
        <>
          <Rect x={x0} y={y0 + 4} width={w} height={h} rx={14} ry={14} fill={material.sombra} />
          <Rect x={x0} y={y0} width={w} height={h} rx={14} ry={14} fill={elemento.tipo === 'barra' ? material.barra : material.ambiente} stroke={material.borde} strokeWidth={1.5} />
          <SvgText x={c} y={c + tamTexto * 0.35} fontSize={tamTexto} fontWeight="600" fontFamily={fuenteSvg('600')} fill={elemento.tipo === 'barra' ? material.barraTexto : colorTexto} textAnchor="middle">{etiqueta}</SvgText>
        </>
      );
      break;
    case 'pared':
    case 'columna':
      cuerpo = <Rect x={x0} y={y0} width={w} height={h} rx={3} ry={3} fill={material.pared} />;
      break;
    case 'ventana':
      cuerpo = (
        <>
          <Rect x={x0} y={y0} width={w} height={h} rx={2} ry={2} fill={material.vidrio} fillOpacity={0.28} stroke={material.vidrio} strokeWidth={2} />
          <Line x1={x0 + 4} y1={c} x2={x0 + w - 4} y2={c} stroke={material.vidrio} strokeWidth={1.5} />
        </>
      );
      break;
    case 'puerta':
      cuerpo = (
        <>
          <Rect x={x0} y={y0} width={w} height={h} fill={material.piso} />
          <Line x1={x0} y1={c} x2={x0} y2={c - w} stroke={material.pared} strokeWidth={4} strokeLinecap="round" />
          <Path d={`M ${x0} ${c - w} A ${w} ${w} 0 0 1 ${x0 + w} ${c}`} stroke={material.pared} strokeWidth={1.5} strokeDasharray="6 6" fill="none" />
        </>
      );
      break;
    case 'planta': {
      const r = Math.min(w, h) / 2;
      cuerpo = (
        <>
          <Circle cx={c} cy={c + 3} r={r} fill={material.sombra} />
          <Circle cx={c} cy={c} r={r} fill={material.plantaClara} />
          {[0, 72, 144, 216, 288].map((a) => (
            <Circle key={a} cx={c + Math.cos((a * Math.PI) / 180) * r * 0.45} cy={c + Math.sin((a * Math.PI) / 180) * r * 0.45} r={r * 0.38} fill={material.planta} />
          ))}
        </>
      );
      break;
    }
    default:
      // cocina, baños: ambientes con rótulo
      cuerpo = (
        <>
          <Rect x={x0} y={y0} width={w} height={h} rx={10} ry={10} fill={material.ambiente} stroke={material.borde} strokeWidth={2} />
          <SvgText x={c} y={c + tamTexto * 0.35} fontSize={tamTexto} fontWeight="600" fontFamily={fuenteSvg('600')} fill={colorTexto} textAnchor="middle">{etiqueta}</SvgText>
        </>
      );
  }
  return (
    <Svg width={L} height={L} viewBox={`0 0 ${L} ${L}`}>
      <G transform={`rotate(${elemento.rot} ${c} ${c})`}>
        {cuerpo}
        {seleccionado ? <Rect x={x0 - 8} y={y0 - 8} width={w + 16} height={h + 16} rx={12} ry={12} fill="none" stroke={colorSeleccion} strokeWidth={3} strokeDasharray="10 8" /> : null}
      </G>
    </Svg>
  );
}

export function ZonaSvg({ zona, color, dark, seleccionada, colorSeleccion }: { zona: ZonaPlano; color: string; dark: boolean; seleccionada?: boolean; colorSeleccion: string }) {
  return (
    <Svg width={zona.w} height={zona.h} viewBox={`0 0 ${zona.w} ${zona.h}`}>
      <Rect x={1.5} y={1.5} width={zona.w - 3} height={zona.h - 3} rx={26} ry={26} fill={color} fillOpacity={dark ? 0.13 : 0.08} stroke={seleccionada ? colorSeleccion : color} strokeOpacity={seleccionada ? 1 : 0.4} strokeWidth={seleccionada ? 4 : 2} strokeDasharray={seleccionada ? '14 10' : undefined} />
      <SvgText x={26} y={44} fontSize={26} fontWeight="600" fontFamily={fuenteSvg('600')} fill={color}>{zona.nombre}</SvgText>
    </Svg>
  );
}
