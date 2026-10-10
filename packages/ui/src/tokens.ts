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
