import { StyleSheet, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import type { ProductoCarta } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Button, PressableScale, Sheet, Text, haptic, radius, space, useTheme } from '@vase/ui';
import { FotoPlato } from '@/components/FotoPlato';
import type { Textos } from '@/lib/i18n';
import { FilaEtiquetas } from './Etiquetas';

interface Props {
  plato: ProductoCarta | null;
  porId: Map<string, ProductoCarta>;
  textos: Textos;
  puedePedir: boolean;
  onClose: () => void;
  onAbrir: (plato: ProductoCarta) => void;
  onAgregar: (plato: ProductoCarta) => void;
}

/** Detalle de un plato con foto grande y qué pedir junto a él. */
export function DetallePlato({ plato, porId, textos, puedePedir, onClose, onAbrir, onAgregar }: Props) {
  const { colors } = useTheme();
  const acompanamientos = (plato?.acompanamientos ?? []).map((id) => porId.get(id)).filter((p): p is ProductoCarta => !!p && p.disponible);
  return (
    <Sheet
      open={!!plato}
      onClose={onClose}
      footer={plato && puedePedir && plato.disponible ? <Button label={`${textos.agregar} · ${formatearARS(plato.precio, true)}`} size="lg" full onPress={() => { haptic.exito(); onAgregar(plato); onClose(); }} /> : undefined}
    >
      {plato ? (
        <View style={styles.cuerpo}>
          {plato.imagenUrl ? <FotoPlato ruta={plato.imagenUrl} ancho={480} alto={280} radio={radius.lg} style={{ width: '100%' }} /> : null}
          <View style={{ gap: space.sm }}>
            <Text variant="title2">{plato.nombre}</Text>
            {plato.descripcion ? <Text variant="body" color="secondary">{plato.descripcion}</Text> : null}
            <FilaEtiquetas etiquetas={plato.etiquetas} textos={textos} />
            <View style={styles.precios}>
              {plato.happy ? <Text variant="body" color="tertiary" numeric style={styles.tachado}>{formatearARS(plato.precioLista, true)}</Text> : null}
              <Text variant="title3" numeric style={plato.happy ? { color: colors.tint } : undefined}>{formatearARS(plato.precio, true)}</Text>
              {!plato.disponible ? <Text variant="subhead" weight="600" color="danger">{textos.agotadoPorHoy}</Text> : null}
            </View>
          </View>
          {acompanamientos.length ? (
            <View style={{ gap: space.sm }}>
              <Text variant="footnote" weight="600" color="secondary">{textos.vaBienCon.toUpperCase()}</Text>
              {acompanamientos.map((a) => (
                <View key={a.id} style={[styles.sugerido, { backgroundColor: colors.surface }]}>
                  <PressableScale onPress={() => onAbrir(a)} scaleTo={0.99} accessibilityLabel={a.nombre} style={styles.sugeridoTexto}>
                    <FotoPlato ruta={a.imagenUrl} ancho={52} radio={10} />
                    <View style={{ flex: 1 }}>
                      <Text variant="subhead" weight="600" numberOfLines={1}>{a.nombre}</Text>
                      <Text variant="footnote" color="secondary" numeric>{formatearARS(a.precio, true)}</Text>
                    </View>
                  </PressableScale>
                  {puedePedir ? (
                    <PressableScale onPress={() => { haptic.ligero(); onAgregar(a); }} accessibilityLabel={`${textos.agregar} ${a.nombre}`} style={[styles.mas, { backgroundColor: colors.tintSoft }]}>
                      <Plus size={18} color={colors.tint} strokeWidth={2.6} />
                    </PressableScale>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.xl, paddingBottom: space.md },
  precios: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tachado: { textDecorationLine: 'line-through' },
  sugerido: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, paddingRight: space.md, borderRadius: radius.md },
  sugeridoTexto: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  mas: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
