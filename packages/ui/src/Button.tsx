import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius } from './tokens';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'filled' | 'tinted' | 'plain' | 'destructive';
  size?: 'lg' | 'md' | 'sm';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const HEIGHT = { lg: 54, md: 48, sm: 36 } as const;

/** Un solo botón "filled" por pantalla: es la acción principal. */
export function Button({ label, onPress, variant = 'filled', size = 'md', icon, loading, disabled, full, style, accessibilityLabel }: ButtonProps) {
  const { colors } = useTheme();
  const palette = {
    filled: { bg: colors.tint, fg: 'onTint' as const },
    tinted: { bg: colors.tintSoft, fg: 'tint' as const },
    plain: { bg: 'transparent', fg: 'tint' as const },
    destructive: { bg: colors.dangerSoft, fg: 'danger' as const },
  }[variant];
  const inactive = disabled || loading;
  return (
    <PressableScale
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      feedback={variant === 'filled' ? 'ligero' : false}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={size === 'sm' ? 8 : 0}
      style={[
        styles.base,
        { height: HEIGHT[size], backgroundColor: palette.bg, borderRadius: size === 'sm' ? radius.pill : radius.md, opacity: disabled ? 0.4 : 1 },
        size === 'sm' && styles.small,
        full && styles.full,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'filled' ? colors.onTint : colors.tint} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text variant={size === 'sm' ? 'subhead' : 'headline'} color={palette.fg} weight="600">{label}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderCurve: 'continuous' },
  small: { paddingHorizontal: 14 },
  full: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
