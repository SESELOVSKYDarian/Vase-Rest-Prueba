import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space } from './tokens';
import { ChevronRight } from 'lucide-react-native';

/**
 * Lista agrupada ("inset grouped"): un bloque redondeado sobre el fondo, filas separadas
 * por una línea fina que arranca después del ícono. Sin cajas dentro de cajas.
 */
export function Group({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.wrap}>
      {header ? <Text variant="footnote" color="secondary" style={styles.header}>{header}</Text> : null}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {rows.map((row, index) => (
          <View key={row.key ?? index}>
            {row}
            {index < rows.length - 1 ? <View style={[styles.separator, { backgroundColor: colors.separator }]} /> : null}
          </View>
        ))}
      </View>
      {footer ? <Text variant="footnote" color="secondary" style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

export interface RowProps {
  title: string;
  subtitle?: string;
  /** Contenido propio bajo el título (reemplaza a `subtitle`): precios, etiquetas. */
  detail?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
}

export function Row({ title, subtitle, detail, leading, trailing, value, onPress, chevron, destructive, accessibilityLabel }: RowProps) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.row}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <Text variant="body" color={destructive ? 'danger' : 'label'} numberOfLines={2}>{title}</Text>
        {detail ?? (subtitle ? <Text variant="footnote" color="secondary" numberOfLines={2}>{subtitle}</Text> : null)}
      </View>
      {value ? <Text variant="body" color="secondary" numeric numberOfLines={1}>{value}</Text> : null}
      {trailing}
      {chevron ? <ChevronRight size={18} color={colors.labelTertiary} strokeWidth={2.4} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} accessibilityLabel={accessibilityLabel ?? title} style={styles.pressable}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  header: { paddingHorizontal: space.lg + space.xs },
  footer: { paddingHorizontal: space.lg + space.xs },
  card: { borderRadius: radius.lg, overflow: 'hidden', borderCurve: 'continuous' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  row: { minHeight: 52, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  pressable: {},
  leading: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
