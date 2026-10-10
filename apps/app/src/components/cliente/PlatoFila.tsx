import { StyleSheet, View } from 'react-native';
import { Plus, Sparkles } from 'lucide-react-native';
import type { ProductoCarta } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { PressableScale, Text, haptic, radius, space, useTheme } from '@vase/ui';
import { FotoPlato } from '@/components/FotoPlato';
import type { Textos } from '@/lib/i18n';
import { FilaEtiquetas } from './Etiquetas';

interface Props {
  plato: ProductoCarta;
  textos: Textos;
  ancho: number;
  /** Con mesa elegida se puede sumar al pedido con un toque. */
  puedePedir: boolean;
  cantidad: number;
  onAbrir: () => void;
  onAgregar: () => void;
}

/** Un plato de la carta: nombre, descripción, etiquetas, precio (con el de lista tachado si hay happy hour) y foto. */
export function PlatoFila({ plato, textos, ancho, puedePedir, cantidad, onAbrir, onAgregar }: Props) {
  const { colors } = useTheme();
  const foto = !!plato.imagenUrl;
  const boton = puedePedir && plato.disponible;
  return (
    <View style={[styles.contenedor, !plato.disponible && { opacity: 0.5 }]}>
      <PressableScale
        onPress={onAbrir}
        scaleTo={0.99}
        accessibilityLabel={`${plato.nombre}, ${formatearARS(plato.precio, true)}${plato.disponible ? '' : `, ${textos.agotado}`}`}
        style={[styles.fila, !foto && boton && { paddingRight: 0 }]}
      >
        <View style={styles.texto}>
          {plato.masPedido && plato.disponible ? (
            <View style={styles.popular}>
              <Sparkles size={13} color={colors.tint} strokeWidth={2.4} />
              <Text variant="caption" weight="700" color="tint">{textos.masPedido}</Text>
            </View>
          ) : null}
          <Text variant="headline">{plato.nombre}</Text>
          {plato.descripcion ? <Text variant="subhead" color="secondary" numberOfLines={2}>{plato.descripcion}</Text> : null}
          <FilaEtiquetas etiquetas={plato.etiquetas} textos={textos} />
          <View style={styles.precios}>
            {plato.happy ? <Text variant="subhead" color="tertiary" numeric style={styles.tachado}>{formatearARS(plato.precioLista, true)}</Text> : null}
            <Text variant="callout" weight="700" numeric style={plato.happy ? { color: colors.tint } : undefined}>{formatearARS(plato.precio, true)}</Text>
            {!plato.disponible ? <Text variant="footnote" weight="600" color="danger">{textos.agotado}</Text> : null}
          </View>
        </View>
        {foto ? <FotoPlato ruta={plato.imagenUrl} ancho={ancho} radio={14} /> : null}
      </PressableScale>
      {boton ? (
        <PressableScale
          onPress={() => { haptic.ligero(); onAgregar(); }}
          accessibilityLabel={`${textos.agregar} ${plato.nombre}`}
          style={[foto ? styles.agregarSobreFoto : styles.agregar, { backgroundColor: cantidad > 0 ? colors.tint : colors.surface2, borderColor: colors.separator }]}
        >
          {cantidad > 0 ? <Text variant="subhead" weight="700" style={{ color: colors.onTint }}>{cantidad}</Text> : <Plus size={20} color={colors.tint} strokeWidth={2.6} />}
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flexDirection: 'row', alignItems: 'center' },
  fila: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  texto: { flex: 1, gap: space.xs },
  popular: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  precios: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  tachado: { textDecorationLine: 'line-through' },
  agregar: { width: 40, height: 40, marginRight: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  agregarSobreFoto: { position: 'absolute', right: space.lg - 6, bottom: space.lg - 6, width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 4px 12px rgba(0,0,0,0.18)' },
});
