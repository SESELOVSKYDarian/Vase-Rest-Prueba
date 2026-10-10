import { StyleSheet, View } from 'react-native';
import { ETIQUETA_ESTADO_MESA, type EstadoMesa } from '@vase/domain';
import { Text } from './Text';
import { useTheme } from './theme';
import { estadoMesaColor, radius } from './tokens';

export function useEstadoColor() {
  const { dark } = useTheme();
  return (estado: EstadoMesa) => estadoMesaColor[estado][dark ? 'dark' : 'light'];
}

/** Estado de mesa: punto de color + etiqueta de texto (el color nunca va solo). */
export function StatusPill({ estado, compact }: { estado: EstadoMesa; compact?: boolean }) {
  const colorDe = useEstadoColor();
  const { dark } = useTheme();
  const color = colorDe(estado);
  return (
    <View style={[styles.pill, { backgroundColor: color + (dark ? '33' : '1F') }]} accessibilityLabel={`Estado: ${ETIQUETA_ESTADO_MESA[estado]}`}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant={compact ? 'caption' : 'footnote'} weight="600" numberOfLines={1}>{ETIQUETA_ESTADO_MESA[estado]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
