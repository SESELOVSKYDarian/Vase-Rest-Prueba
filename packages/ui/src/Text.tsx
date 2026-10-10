import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from './theme';
import { tabular, textStyle, type TextVariant, type Weight } from './tokens';

export type TextColor = 'label' | 'secondary' | 'tertiary' | 'tint' | 'danger' | 'onTint' | 'warning';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: Weight;
  /** Números con ancho fijo (importes, mesas, tiempos). */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'label', weight, numeric, align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const map = {
    label: colors.label,
    secondary: colors.labelSecondary,
    tertiary: colors.labelTertiary,
    tint: colors.tint,
    danger: colors.danger,
    onTint: colors.onTint,
    warning: colors.warning,
  } as const;
  return <RNText {...rest} style={[textStyle(variant, weight), { color: map[color], textAlign: align }, numeric && tabular, style]} />;
}
