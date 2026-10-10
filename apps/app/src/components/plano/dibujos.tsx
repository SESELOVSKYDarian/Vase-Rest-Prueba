import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { ETIQUETA_ELEMENTO, MEDIDA_SILLA, posicionesSillas, type ElementoPlano, type MesaEnPlano, type ZonaPlano } from '@vase/domain';
import type { PlanoMaterial } from '@vase/ui';

/** Familia tipográfica para textos SVG (en iOS la del sistema; en el resto, Inter ya cargada). */
export const fuenteSvg = (peso: '600' | '700') =>
  Platform.OS === 'ios' ? undefined : Platform.OS === 'web' ? `-apple-system, BlinkMacSystemFont, Inter, 'Segoe UI', sans-serif` : peso === '700' ? 'Inter_700Bold' : 'Inter_600SemiBold';

/** Espacio que ocupan las sillas alrededor de la mesa (cm). */
export const MARGEN_SILLAS = MEDIDA_SILLA.separacion + MEDIDA_SILLA.h + 6;
/** Aire alrededor de la mesa para el anillo de estado. */
const ANILLO = 9;

/** Lado del cuadro que contiene la mesa con sus sillas, para cualquier rotación. */
export const ladoMesa = (m: Pick<MesaEnPlano, 'ancho' | 'alto'>) => Math.ceil(Math.hypot(m.ancho, m.alto) + MARGEN_SILLAS * 2);

interface MesaSvgProps {
  mesa: MesaEnPlano;
  material: PlanoMaterial;
  numero: string;
  detalle?: string;
  /** Color del estado (servicio) o null en edición. */
  colorEstado: string | null;
  /** La mesa no está libre: en el estilo arquitectónico se marca con un anillo del color del estado. */
  resaltar?: boolean;
  /** Mesa con gente: en el estilo claro la superficie toma un tinte del estado. */
  ocupada?: boolean;
  seleccionada?: boolean;
  colorSeleccion: string;
}

export function MesaSvg({ mesa, material: m, numero, detalle, colorEstado, resaltar, ocupada, seleccionada, colorSeleccion }: MesaSvgProps) {
  const L = ladoMesa(mesa);
  const c = L / 2;
  const sillas = posicionesSillas(mesa);
  const arq = m.arquitectonico;
  const radio = arq ? (mesa.forma === 'cuadrada' ? 8 : 10) : mesa.forma === 'cuadrada' ? 12 : 16;
  const radioSilla = arq ? 13 : 11;

  // Tapa de la mesa, opcionalmente agrandada (`extra`) para dibujar anillos alrededor.
  const tapa = (p: { dy?: number; extra?: number; fill: string; stroke?: string; sw?: number; opacidad?: number; dash?: string }) => {
    const { dy = 0, extra = 0, fill, stroke, sw = 0, opacidad = 1, dash } = p;
    return mesa.forma === 'circular' ? (
      <Circle cx={c} cy={c + dy} r={mesa.ancho / 2 + extra} fill={fill} fillOpacity={opacidad} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
    ) : (
      <Rect x={c - mesa.ancho / 2 - extra} y={c - mesa.alto / 2 + dy - extra} width={mesa.ancho + extra * 2} height={mesa.alto + extra * 2} rx={radio + extra} ry={radio + extra} fill={fill} fillOpacity={opacidad} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
    );
  };

  // Claro: el borde de la mesa lleva el color del estado. Arquitectónico: anillo alrededor (solo si no está libre).
  const bordeClaro = seleccionada ? colorSeleccion : colorEstado ?? m.mesaBorde;
  const anillo = arq && colorEstado && resaltar ? colorEstado : null;

  return (
    <Svg width={L} height={L} viewBox={`0 0 ${L} ${L}`}>
      <G transform={`rotate(${mesa.rot} ${c} ${c})`}>
        {sillas.map((s, i) => (
          <G key={i} transform={`translate(${c + s.x} ${c + s.y}) rotate(${s.rot})`}>
            <Rect x={-MEDIDA_SILLA.w / 2} y={-MEDIDA_SILLA.h / 2 + 3} width={MEDIDA_SILLA.w} height={MEDIDA_SILLA.h} rx={radioSilla} ry={radioSilla} fill={m.sombra} />
            <Rect x={-MEDIDA_SILLA.w / 2} y={-MEDIDA_SILLA.h / 2} width={MEDIDA_SILLA.w} height={MEDIDA_SILLA.h} rx={radioSilla} ry={radioSilla} fill={m.silla} stroke={m.sillaBorde} strokeWidth={1.5} />
            <Rect x={-MEDIDA_SILLA.w / 2 + 4} y={-MEDIDA_SILLA.h / 2 + 3} width={MEDIDA_SILLA.w - 8} height={arq ? 10 : 9} rx={5} ry={5} fill={m.respaldo} />
          </G>
        ))}
        {anillo ? tapa({ extra: ANILLO, fill: anillo, opacidad: 0.22, stroke: anillo, sw: 5 }) : null}
        {tapa({ dy: arq ? 6 : 5, fill: m.sombra })}
        {arq ? tapa({ fill: m.mesa, stroke: m.mesaBorde, sw: 2.5 }) : tapa({ fill: m.mesa, stroke: bordeClaro, sw: seleccionada || colorEstado ? 4 : 2 })}
        {/* Tinte suave del estado sobre la tapa: la mesa con gente se lee de lejos. */}
        {!arq && ocupada && colorEstado ? tapa({ fill: colorEstado, stroke: colorEstado, sw: 4, opacidad: 0.16 }) : null}
        {arq && seleccionada ? tapa({ extra: ANILLO + 4, fill: 'none', stroke: colorSeleccion, sw: 4, dash: '12 8' }) : null}
      </G>
      <SvgText x={c} y={detalle ? c + 4 : c + 10} fontSize={30} fontWeight="700" fontFamily={fuenteSvg('700')} fill={m.textoMesa} textAnchor="middle">
        {numero}
      </SvgText>
      {detalle ? (
        <SvgText x={c} y={c + 28} fontSize={16} fontWeight="600" fontFamily={fuenteSvg('600')} fill={m.textoMesaSec} textAnchor="middle">
          {detalle}
        </SvgText>
      ) : null}
    </Svg>
  );
}

/** Banquetas a lo largo de la barra (cm). */
const BANQUETA = { r: 17, separacion: 62, distancia: 30 };

/** Alto efectivo de un elemento con lo que lo rodea (barrido de la puerta, banquetas de la barra). */
const altoConEntorno = (e: Pick<ElementoPlano, 'tipo' | 'w' | 'h'>) =>
  e.tipo === 'puerta' ? Math.max(e.h, e.w) * 2 : e.tipo === 'barra' ? e.h + (BANQUETA.distancia + BANQUETA.r) * 2 + 8 : e.h;

/** Lado del cuadro que contiene un elemento rotado. */
export const ladoElemento = (e: Pick<ElementoPlano, 'tipo' | 'w' | 'h'>) => Math.ceil(Math.hypot(e.w, altoConEntorno(e)) + 8);

interface ElementoSvgProps {
  elemento: ElementoPlano;
  material: PlanoMaterial;
  seleccionado?: boolean;
  colorSeleccion: string;
}

export function ElementoSvg({ elemento, material: m, seleccionado, colorSeleccion }: ElementoSvgProps) {
  const L = ladoElemento(elemento);
  const c = L / 2;
  const { w, h } = elemento;
  const x0 = c - w / 2;
  const y0 = c - h / 2;
  const arq = m.arquitectonico;
  const linea = arq ? m.muro : m.pared;
  const etiqueta = elemento.etiqueta || ETIQUETA_ELEMENTO[elemento.tipo];
  const tamTexto = Math.max(14, Math.min(26, h * 0.32, (w / Math.max(4, etiqueta.length)) * 1.6));
  // El rótulo gira con el objeto, pero nunca queda cabeza abajo.
  const giro = ((elemento.rot % 360) + 360) % 360;
  const enderezar = giro > 90 && giro <= 270 ? `rotate(180 ${c} ${c})` : undefined;
  const rotulo = (color: string, opciones: { y?: number; tam?: number; mayus?: boolean } = {}) => {
    const tam = opciones.tam ?? tamTexto;
    return (
      <SvgText transform={enderezar} x={c} y={opciones.y ?? c + tam * 0.35} fontSize={tam} fontWeight="600" fontFamily={fuenteSvg('600')} fill={color} textAnchor="middle" letterSpacing={opciones.mayus ? 2 : 0}>
        {opciones.mayus ? etiqueta.toUpperCase() : etiqueta}
      </SvgText>
    );
  };

  let cuerpo: ReactNode;
  switch (elemento.tipo) {
    case 'barra': {
      const banquetas = Math.max(1, Math.floor((w - 20) / BANQUETA.separacion));
      const inicio = c - ((banquetas - 1) * BANQUETA.separacion) / 2;
      const yb = y0 + h + BANQUETA.distancia;
      cuerpo = (
        <>
          {arq
            ? Array.from({ length: banquetas }, (_, i) => {
                const xb = inicio + i * BANQUETA.separacion;
                return (
                  <G key={i}>
                    <Circle cx={xb} cy={yb + 3} r={BANQUETA.r} fill={m.sombra} />
                    <Circle cx={xb} cy={yb} r={BANQUETA.r} fill={m.banqueta} stroke={m.sillaBorde} strokeWidth={1.5} />
                    <Circle cx={xb} cy={yb} r={BANQUETA.r * 0.45} fill={m.respaldo} />
                  </G>
                );
              })
            : null}
          <Rect x={x0} y={y0 + 5} width={w} height={h} rx={arq ? 6 : 14} ry={arq ? 6 : 14} fill={m.sombra} />
          <Rect x={x0} y={y0} width={w} height={h} rx={arq ? 6 : 14} ry={arq ? 6 : 14} fill={m.barra} stroke={arq ? m.mesaBorde : m.borde} strokeWidth={arq ? 2.5 : 1.5} />
          {rotulo(m.barraTexto, arq ? { mayus: true, tam: Math.min(20, tamTexto) } : {})}
        </>
      );
      break;
    }
    case 'caja':
      cuerpo = (
        <>
          <Rect x={x0} y={y0 + 4} width={w} height={h} rx={arq ? 6 : 14} ry={arq ? 6 : 14} fill={m.sombra} />
          <Rect x={x0} y={y0} width={w} height={h} rx={arq ? 6 : 14} ry={arq ? 6 : 14} fill={arq ? m.barra : m.ambiente} stroke={arq ? m.mesaBorde : m.borde} strokeWidth={arq ? 2.5 : 1.5} />
          {rotulo(arq ? m.barraTexto : m.texto, arq ? { mayus: true, tam: Math.min(18, tamTexto) } : {})}
        </>
      );
      break;
    case 'pared':
    case 'columna':
      cuerpo = <Rect x={x0} y={y0} width={w} height={h} rx={arq ? 0 : 3} ry={arq ? 0 : 3} fill={linea} />;
      break;
    case 'ventana':
      cuerpo = (
        <>
          {arq ? <Rect x={x0} y={y0} width={w} height={h} fill={m.fondo} /> : null}
          <Rect x={x0} y={y0} width={w} height={h} rx={arq ? 0 : 2} ry={arq ? 0 : 2} fill={m.vidrio} fillOpacity={arq ? 0.35 : 0.28} stroke={m.vidrio} strokeWidth={2} />
          <Line x1={x0 + 4} y1={c} x2={x0 + w - 4} y2={c} stroke={m.vidrio} strokeWidth={1.5} />
        </>
      );
      break;
    case 'puerta':
      cuerpo = (
        <>
          {/* El vano corta la pared: se pinta con el piso. */}
          <Rect x={x0} y={y0} width={w} height={h} fill={m.piso} />
          <Line x1={x0} y1={c} x2={x0} y2={c - w} stroke={linea} strokeWidth={4} strokeLinecap="round" />
          <Path d={`M ${x0} ${c - w} A ${w} ${w} 0 0 1 ${x0 + w} ${c}`} stroke={linea} strokeOpacity={arq ? 0.75 : 1} strokeWidth={1.5} strokeDasharray="6 6" fill="none" />
        </>
      );
      break;
    case 'planta': {
      const r = Math.min(w, h) / 2;
      cuerpo = (
        <>
          <Circle cx={c} cy={c + 4} r={r} fill={m.sombra} />
          <Circle cx={c} cy={c} r={r} fill={m.plantaClara} />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <Circle key={a} cx={c + Math.cos((a * Math.PI) / 180) * r * 0.5} cy={c + Math.sin((a * Math.PI) / 180) * r * 0.5} r={r * 0.36} fill={m.planta} />
          ))}
          <Circle cx={c} cy={c} r={r * 0.22} fill={m.plantaClara} />
        </>
      );
      break;
    }
    case 'cocina': {
      if (!arq) {
        cuerpo = (
          <>
            <Rect x={x0} y={y0} width={w} height={h} rx={10} ry={10} fill={m.ambiente} stroke={m.borde} strokeWidth={2} />
            {rotulo(m.texto)}
          </>
        );
        break;
      }
      // Mesadas arriba y abajo con hornallas; el nombre en el medio.
      const columnas = Math.max(2, Math.floor((w - 40) / 70));
      const paso = (w - 40) / columnas;
      const lado = Math.min(paso - 16, h * 0.3);
      cuerpo = (
        <>
          <Rect x={x0} y={y0} width={w} height={h} fill={m.cocina} stroke={m.muro} strokeWidth={8} />
          {Array.from({ length: columnas }, (_, i) => (
            <G key={i}>
              <Rect x={x0 + 20 + i * paso + (paso - lado) / 2} y={y0 + 18} width={lado} height={lado} rx={4} ry={4} fill={m.hornalla} />
              <Rect x={x0 + 20 + i * paso + (paso - lado) / 2} y={y0 + h - 18 - lado} width={lado} height={lado} rx={4} ry={4} fill={m.hornalla} fillOpacity={0.55} />
            </G>
          ))}
          {rotulo(m.texto, { mayus: true, tam: Math.min(20, tamTexto) })}
        </>
      );
      break;
    }
    case 'escalera': {
      const escalones = Math.max(3, Math.floor(h / 28));
      const flecha = arq ? m.texto : m.pared;
      cuerpo = (
        <>
          <Rect x={x0} y={y0} width={w} height={h} fill={arq ? m.piso : m.ambiente} stroke={linea} strokeWidth={3} />
          {Array.from({ length: escalones - 1 }, (_, i) => (
            <Line key={i} x1={x0} y1={y0 + ((i + 1) * h) / escalones} x2={x0 + w} y2={y0 + ((i + 1) * h) / escalones} stroke={linea} strokeOpacity={0.7} strokeWidth={2} />
          ))}
          <Line x1={c} y1={y0 + h - 16} x2={c} y2={y0 + 18} stroke={flecha} strokeWidth={3} strokeLinecap="round" />
          <Path d={`M ${c - 12} ${y0 + 32} L ${c} ${y0 + 16} L ${c + 12} ${y0 + 32}`} stroke={flecha} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
      break;
    }
    case 'pasillo': {
      // Recorrido de circulación: línea punteada con flecha.
      const trazo = arq ? m.texto : m.pared;
      cuerpo = (
        <>
          <Line x1={x0 + 6} y1={c} x2={x0 + w - 18} y2={c} stroke={trazo} strokeOpacity={0.85} strokeWidth={4} strokeDasharray="14 12" strokeLinecap="round" />
          <Path d={`M ${x0 + w - 26} ${c - 12} L ${x0 + w - 8} ${c} L ${x0 + w - 26} ${c + 12}`} stroke={trazo} strokeOpacity={0.85} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
      break;
    }
    default:
      // Baños y otros ambientes con rótulo.
      cuerpo = (
        <>
          <Rect x={x0} y={y0} width={w} height={h} rx={arq ? 0 : 10} ry={arq ? 0 : 10} fill={m.ambiente} stroke={arq ? m.muro : m.borde} strokeWidth={arq ? 8 : 2} />
          {rotulo(m.texto, arq ? { mayus: true, tam: Math.min(20, tamTexto) } : {})}
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

interface ZonaSvgProps {
  zona: ZonaPlano;
  material: PlanoMaterial;
  /** Color de la zona en el estilo claro. */
  color: string;
  dark: boolean;
  seleccionada?: boolean;
  colorSeleccion: string;
}

export function ZonaSvg({ zona, material: m, color, dark, seleccionada, colorSeleccion }: ZonaSvgProps) {
  if (m.arquitectonico && m.zonaPiso) {
    // Ambiente: piso propio rodeado de muros, con el nombre en versalitas.
    return (
      <Svg width={zona.w} height={zona.h} viewBox={`0 0 ${zona.w} ${zona.h}`}>
        <Rect x={5} y={5} width={zona.w - 10} height={zona.h - 10} fill={m.zonaPiso[zona.color]} />
        <Rect x={5} y={5} width={zona.w - 10} height={zona.h - 10} fill="none" stroke={m.muro} strokeWidth={10} />
        <Rect x={5} y={5} width={zona.w - 10} height={zona.h - 10} fill="none" stroke={m.muroLinea} strokeWidth={1.5} />
        <SvgText x={30} y={46} fontSize={20} fontWeight="600" fontFamily={fuenteSvg('600')} fill={m.texto} fillOpacity={0.9} letterSpacing={3}>
          {zona.nombre.toUpperCase()}
        </SvgText>
        {seleccionada ? <Rect x={2} y={2} width={zona.w - 4} height={zona.h - 4} fill="none" stroke={colorSeleccion} strokeWidth={4} strokeDasharray="14 10" /> : null}
      </Svg>
    );
  }
  return (
    <Svg width={zona.w} height={zona.h} viewBox={`0 0 ${zona.w} ${zona.h}`}>
      <Rect x={1.5} y={1.5} width={zona.w - 3} height={zona.h - 3} rx={26} ry={26} fill={color} fillOpacity={dark ? 0.13 : 0.08} stroke={seleccionada ? colorSeleccion : color} strokeOpacity={seleccionada ? 1 : 0.4} strokeWidth={seleccionada ? 4 : 2} strokeDasharray={seleccionada ? '14 10' : undefined} />
      <SvgText x={26} y={44} fontSize={26} fontWeight="600" fontFamily={fuenteSvg('600')} fill={color}>{zona.nombre}</SvgText>
    </Svg>
  );
}
