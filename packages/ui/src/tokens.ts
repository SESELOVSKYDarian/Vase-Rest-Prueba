import { Platform, type TextStyle } from 'react-native';
import type { EstadoMesa } from '@vase/domain';

/**
 * Tokens del sistema de diseño "Servicio" — estilo Apple adaptado a un local gastronómico.
 * Colores en hex/rgba (React Native no resuelve OKLCH en todas las plataformas).
 * Contrastes verificados: label sobre bg ≥ 12:1, labelSecondary ≥ 5:1, tint sobre surface ≥ 5:1.
 */
export interface Palette {
  bg: string;            // fondo de pantalla (grouped background)
  surface: string;       // tarjetas y listas
  surface2: string;      // superficie elevada sobre surface (hojas, popovers)
  label: string;
  labelSecondary: string;
  labelTertiary: string; // solo decorativo / placeholders grandes
  separator: string;
  fill: string;          // controles (segmentado, campos)
  fillSoft: string;
  tint: string;          // único color de acción
  tintStrong: string;
  tintSoft: string;
  onTint: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  scrim: string;
  blurTint: 'light' | 'dark';
}

export const lightPalette: Palette = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  surface2: '#FFFFFF',
  label: '#1C1C1E',
  labelSecondary: '#5C5C63',
  labelTertiary: '#8A8A90',
  separator: 'rgba(60,60,67,0.16)',
  fill: 'rgba(120,120,128,0.12)',
  fillSoft: 'rgba(120,120,128,0.07)',
  tint: '#177A4E',
  tintStrong: '#0F5F3B',
  tintSoft: 'rgba(23,122,78,0.12)',
  onTint: '#FFFFFF',
  danger: '#C8261D',
  dangerSoft: 'rgba(200,38,29,0.10)',
  warning: '#9A5B00',
  scrim: 'rgba(0,0,0,0.32)',
  blurTint: 'light',
};

export const darkPalette: Palette = {
  bg: '#0C0C0E',
  surface: '#1C1C1E',
  surface2: '#2C2C2E',
  label: '#F5F5F7',
  labelSecondary: '#A6A6AD',
  labelTertiary: '#6E6E75',
  separator: 'rgba(235,235,245,0.14)',
  fill: 'rgba(120,120,128,0.32)',
  fillSoft: 'rgba(120,120,128,0.18)',
  tint: '#4CC38A',
  tintStrong: '#7BD9AA',
  tintSoft: 'rgba(76,195,138,0.18)',
  onTint: '#06210F',
  danger: '#FF6B61',
  dangerSoft: 'rgba(255,107,97,0.16)',
  warning: '#F0B04A',
  scrim: 'rgba(0,0,0,0.55)',
  blurTint: 'dark',
};

/** Color de cada estado de mesa: se comunica con color + etiqueta + ícono, nunca solo color. */
export const estadoMesaColor: Record<EstadoMesa, { light: string; dark: string }> = {
  libre: { light: '#2E9B63', dark: '#4CC38A' },
  ocupada: { light: '#D0503C', dark: '#F07A66' },
  esperando_pedido: { light: '#3F78C6', dark: '#6FA0E8' },
  pedido_listo: { light: '#D77A2E', dark: '#F0A15C' },
  esperando_pago: { light: '#B58A1F', dark: '#E2B84F' },
  para_cobrar: { light: '#8A5FC8', dark: '#B08CEB' },
  problema: { light: '#C2406F', dark: '#EE7BA3' },
};

// Escala de 4 pt. Más aire que el panel anterior: separación entre secciones 32–40.
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, '3xl': 32, '4xl': 40, '5xl': 56, '6xl': 72 } as const;
export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, sheet: 28, pill: 999 } as const;

export const motion = {
  /** Resorte por defecto sin rebote (gestos que se asientan). */
  settle: { duration: 400, dampingRatio: 1 },
  /** Resorte de hoja / soltar un arrastre con inercia. */
  sheet: { duration: 320, dampingRatio: 0.82 },
  /** Press feedback. */
  pressMs: 120,
  /** Cambios chicos de estado (chips, toggles). */
  quickMs: 180,
  /** Entradas (ease-out fuerte). */
  enterMs: 260,
} as const;

export const minTarget = 48; // ≥ 44 pt iOS / 48 dp Android

const apple = Platform.OS === 'ios';

export type Weight = '400' | '500' | '600' | '700';
const INTER: Record<Weight, string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
};

/** iOS usa SF (fuente del sistema); el resto, Inter con las mismas métricas que SF Pro. */
export function fontFor(weight: Weight): TextStyle {
  if (apple) return { fontWeight: weight };
  const family = Platform.OS === 'web'
    ? `-apple-system, BlinkMacSystemFont, ${INTER[weight]}, 'Segoe UI', Roboto, sans-serif`
    : INTER[weight];
  return { fontFamily: family, fontWeight: Platform.OS === 'web' ? weight : undefined };
}

export type TextVariant =
  | 'largeTitle' | 'title1' | 'title2' | 'title3'
  | 'headline' | 'body' | 'callout' | 'subhead' | 'footnote' | 'caption';

interface TextSpec { size: number; line: number; weight: Weight; tracking: number }
// Escala de texto de Apple (puntos).
const SPEC: Record<TextVariant, TextSpec> = {
  largeTitle: { size: 34, line: 41, weight: '700', tracking: apple ? 0.37 : -0.6 },
  title1: { size: 28, line: 34, weight: '700', tracking: apple ? 0.36 : -0.5 },
  title2: { size: 22, line: 28, weight: '600', tracking: apple ? 0.35 : -0.3 },
  title3: { size: 20, line: 25, weight: '600', tracking: apple ? 0.38 : -0.2 },
  headline: { size: 17, line: 22, weight: '600', tracking: apple ? -0.41 : -0.2 },
  body: { size: 17, line: 22, weight: '400', tracking: apple ? -0.41 : -0.15 },
  callout: { size: 16, line: 21, weight: '400', tracking: apple ? -0.32 : -0.1 },
  subhead: { size: 15, line: 20, weight: '400', tracking: apple ? -0.24 : -0.05 },
  footnote: { size: 13, line: 18, weight: '400', tracking: apple ? -0.08 : 0 },
  caption: { size: 12, line: 16, weight: '500', tracking: 0 },
};

export function textStyle(variant: TextVariant, weight?: Weight): TextStyle {
  const s = SPEC[variant];
  return { ...fontFor(weight ?? s.weight), fontSize: s.size, lineHeight: s.line, letterSpacing: s.tracking };
}

/** Importes y números de mesa: ancho fijo para que no "bailen" al cambiar. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const breakpoints = { medium: 600, expanded: 1024 } as const;
export type SizeClass = 'compact' | 'medium' | 'expanded';
export const sizeClassFor = (width: number): SizeClass => (width >= breakpoints.expanded ? 'expanded' : width >= breakpoints.medium ? 'medium' : 'compact');

import type { ColorZona } from '@vase/domain';

/** Colores de zonas del plano: relleno muy suave, borde y rótulo con más presencia. */
export const zonaColor: Record<ColorZona, { light: string; dark: string }> = {
  salvia: { light: '#2E9B63', dark: '#4CC38A' },
  arena: { light: '#B8862F', dark: '#E2BC72' },
  cielo: { light: '#3F78C6', dark: '#6FA0E8' },
  terracota: { light: '#C8643B', dark: '#EE8C66' },
  lavanda: { light: '#8A5FC8', dark: '#B08CEB' },
  grafito: { light: '#6E6E75', dark: '#A6A6AD' },
};

/** "Materiales" del plano: fondo, piso, muros, mesas, sillas, barra y ambientes. */
export interface PlanoMaterial {
  /** Plano de arquitecto: muros rectos, grilla de líneas y ambientes con piso propio. */
  arquitectonico: boolean;
  fondo: string;        // alrededor del local
  grilla: string;
  guia: string;         // líneas de construcción que siguen los muros
  piso: string;
  borde: string;
  muro: string;
  muroLinea: string;    // filete interior del muro
  mesa: string;
  mesaBorde: string;
  sombra: string;
  silla: string;
  sillaBorde: string;
  respaldo: string;
  barra: string;
  barraTexto: string;
  banqueta: string;
  pared: string;
  vidrio: string;
  planta: string;
  plantaClara: string;
  ambiente: string;
  cocina: string;
  hornalla: string;
  texto: string;        // rótulos sobre el piso
  textoMesa: string;    // número sobre la mesa
  textoMesaSec: string;
  /** Piso de cada ambiente (zonas) en el estilo arquitectónico. */
  zonaPiso: Record<ColorZona, string> | null;
}

const claroLight: PlanoMaterial = {
  arquitectonico: false,
  fondo: '#FFFFFF', grilla: 'rgba(60,60,67,0.13)', guia: 'transparent', piso: '#FAF9F6', borde: 'rgba(60,60,67,0.22)',
  muro: 'rgba(60,60,67,0.22)', muroLinea: 'transparent', mesa: '#FFFFFF', mesaBorde: 'rgba(60,60,67,0.22)', sombra: 'rgba(28,28,30,0.10)',
  silla: '#F4F3EF', sillaBorde: 'rgba(60,60,67,0.20)', respaldo: '#D9D5CC', barra: '#CBB79A', barraTexto: '#4A3D2C', banqueta: '#D9D5CC',
  pared: '#48484A', vidrio: '#8FB3D9', planta: '#4F8E5E', plantaClara: '#7DB487', ambiente: '#EFEDE8', cocina: '#EFEDE8', hornalla: '#C9C5BC',
  texto: '#5C5C63', textoMesa: '#1C1C1E', textoMesaSec: '#5C5C63', zonaPiso: null,
};

const claroDark: PlanoMaterial = {
  arquitectonico: false,
  fondo: '#1C1C1E', grilla: 'rgba(235,235,245,0.10)', guia: 'transparent', piso: '#161618', borde: 'rgba(235,235,245,0.18)',
  muro: 'rgba(235,235,245,0.18)', muroLinea: 'transparent', mesa: '#2C2C2E', mesaBorde: 'rgba(235,235,245,0.18)', sombra: 'rgba(0,0,0,0.45)',
  silla: '#242426', sillaBorde: 'rgba(235,235,245,0.16)', respaldo: '#3D3D40', barra: '#5E4E3B', barraTexto: '#F1E4D0', banqueta: '#3D3D40',
  pared: '#9A9AA0', vidrio: '#6F93B8', planta: '#3F7A4E', plantaClara: '#5F9C6D', ambiente: '#1F1F22', cocina: '#1F1F22', hornalla: '#3D3D40',
  texto: '#A6A6AD', textoMesa: '#F5F5F7', textoMesaSec: '#A6A6AD', zonaPiso: null,
};

/**
 * Plano de arquitecto: fondo azul noche con grilla, muros claros, ambientes con piso propio,
 * mesas color crema y sillas terracota. Es igual en modo claro y oscuro (como un mapa).
 */
const azul: PlanoMaterial = {
  arquitectonico: true,
  fondo: '#1D2840', grilla: 'rgba(150,172,214,0.10)', guia: 'rgba(160,184,228,0.22)', piso: '#857F78', borde: 'rgba(255,255,255,0.18)',
  muro: '#CDD0D8', muroLinea: 'rgba(29,40,64,0.55)', mesa: '#F4D3B3', mesaBorde: '#DDAA80', sombra: 'rgba(12,18,34,0.38)',
  silla: '#D9663C', sillaBorde: 'rgba(80,30,10,0.25)', respaldo: '#A8472A', barra: '#F1C9A2', barraTexto: '#5A3A22', banqueta: '#D9663C',
  pared: '#CDD0D8', vidrio: '#A9CBEA', planta: '#4E7F45', plantaClara: '#7EAE63', ambiente: '#5A6884', cocina: '#23304E', hornalla: '#E07848',
  texto: '#F3EEE7', textoMesa: '#3A2818', textoMesaSec: '#7A5236',
  zonaPiso: { salvia: '#6B7A67', arena: '#958C82', cielo: '#58668A', terracota: '#7A5040', lavanda: '#665E82', grafito: '#4A5163' },
};

export const planoMaterial = { light: claroLight, dark: claroDark, azul };

/** Material según el estilo del plano y el modo de la app. */
export function materialPlano(estilo: 'azul' | 'claro' | undefined, dark: boolean): PlanoMaterial {
  return (estilo ?? 'azul') === 'azul' ? azul : dark ? claroDark : claroLight;
}
