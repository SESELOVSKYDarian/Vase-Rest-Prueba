import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { UtensilsCrossed } from 'lucide-react-native';
import { urlArchivo } from '@vase/api';
import { useTheme } from '@vase/ui';

interface Props {
  ruta: string | null | undefined;
  ancho: number;
  alto?: number;
  radio?: number;
  style?: StyleProp<ViewStyle>;
}

/** Foto de un plato con su lugar reservado: sin foto se ve un plato dibujado, nunca un hueco. */
export function FotoPlato({ ruta, ancho, alto = ancho, radio = 12, style }: Props) {
  const { colors } = useTheme();
  const url = urlArchivo(ruta);
  const caja = { width: ancho, height: alto, borderRadius: radio };
  if (!url) {
    return (
      <View style={[caja, styles.vacio, { backgroundColor: colors.fillSoft }, style]}>
        <UtensilsCrossed size={Math.min(ancho, alto) * 0.34} color={colors.labelTertiary} strokeWidth={1.8} />
      </View>
    );
  }
  return (
    <View style={[caja, styles.marco, { backgroundColor: colors.fillSoft }, style]}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
  marco: { overflow: 'hidden', borderCurve: 'continuous' },
});
