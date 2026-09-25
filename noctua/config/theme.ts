// Acentos curados en vez de un selector de color libre: cada uno es solo tono + croma,
// y los niveles de luminosidad los pone el sistema de diseño para cada modo (claro/oscuro).
// Así cualquier elección mantiene contraste AA y la estética del sistema.
export type AccentId = 'salvia' | 'oliva' | 'terracota' | 'pizarra' | 'ciruela' | 'ocre';

export interface Accent {
  id: AccentId;
  label: string;
  hue: number;
  chroma: number;
}

export const ACCENTS: Accent[] = [
  { id: 'salvia', label: 'Salvia', hue: 150, chroma: 0.115 },
  { id: 'oliva', label: 'Oliva', hue: 118, chroma: 0.1 },
  { id: 'ocre', label: 'Ocre', hue: 70, chroma: 0.12 },
  { id: 'terracota', label: 'Terracota', hue: 38, chroma: 0.13 },
  { id: 'ciruela', label: 'Ciruela', hue: 345, chroma: 0.1 },
  { id: 'pizarra', label: 'Pizarra', hue: 250, chroma: 0.09 },
];

export const DEFAULT_ACCENT: AccentId = 'salvia';

export function getAccent(id?: string | null): Accent {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0];
}

export type ThemeMode = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'vase-theme';
