import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';
import { fontFor, space } from './tokens';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
}

/** Fila de formulario dentro de un <Group>: etiqueta fija a la izquierda, texto a la derecha. */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, ...rest }, ref) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="body" style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.labelTertiary}
        selectionColor={colors.tint}
        {...rest}
        style={[styles.input, fontFor('400'), { color: colors.label }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.md },
  label: { width: 104 },
  // outlineStyle: en web el foco ya se ve en la fila; se evita el recuadro azul del navegador.
  input: { flex: 1, fontSize: 17, paddingVertical: space.md, outlineStyle: 'none' as never },
});
