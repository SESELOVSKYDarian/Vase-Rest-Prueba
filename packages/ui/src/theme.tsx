import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
import { darkPalette, lightPalette, sizeClassFor, type Palette, type SizeClass } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeValue {
  colors: Palette;
  dark: boolean;
  mode: ThemeMode;
  sizeClass: SizeClass;
  width: number;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ mode = 'system', children }: { mode?: ThemeMode; children: ReactNode }) {
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const dark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  const value = useMemo<ThemeValue>(
    () => ({ colors: dark ? darkPalette : lightPalette, dark, mode, sizeClass: sizeClassFor(width), width }),
    [dark, mode, width],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return value;
}
