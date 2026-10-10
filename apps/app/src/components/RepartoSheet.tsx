import { StyleSheet, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Sparkles, UserMinus, Users } from 'lucide-react-native';
import { asignarMozo, type MozoCarga } from '@vase/api';
import { iniciales, ordenarPorCarga, sugerirMozo, type Mesa } from '@vase/domain';
import { Button, EmptyState, ErrorBanner, Group, PressableScale, Sheet, Text, haptic, radius, space, useTheme } from '@vase/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  mozos: MozoCarga[];
  /** Con una mesa elegida, tocar a un mozo se la asigna; sin mesa es solo el resumen del turno. */
  mesa?: Mesa | null;
  asignadoId?: string | null;
  onAviso?: (mensaje: string) => void;
}

/** Reparto de mesas entre mozos: quién tiene qué ahora, quién debería recibir la próxima y asignar con un toque. */
export function RepartoSheet({ open, onClose, mozos, mesa, asignadoId, onAviso }: Props) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const orden = ordenarPorCarga(mozos);
  const sugerido = sugerirMozo(mozos.filter((m) => m.id !== asignadoId)) ?? sugerirMozo(mozos);
  const maxPeso = Math.max(1, ...mozos.map((m) => m.mesasActivas * 3 + m.comensalesActivos));

  const asignar = useMutation({
    mutationFn: (mozoId: string | null) => asignarMozo(mesa!.id, mozoId),
    onSuccess: async (_r, mozoId) => {
      haptic.exito();
      onAviso?.(mozoId ? `Mesa ${mesa!.numero} asignada a ${mozos.find((m) => m.id === mozoId)?.nombre ?? 'el mozo'}` : `Mesa ${mesa!.numero} sin mozo asignado`);
      await Promise.all(['estado-salon', 'pedidos'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
      onClose();
    },
    onError: () => haptic.error(),
  });

  return (
    <Sheet open={open} onClose={onClose} title={mesa ? `Mesa ${mesa.numero}: ¿quién la atiende?` : 'Reparto del turno'}>
      <View style={styles.cuerpo}>
        {asignar.isError ? <ErrorBanner message={asignar.error instanceof Error ? asignar.error.message : 'No se pudo asignar'} /> : null}
        {mozos.length === 0 ? (
          <EmptyState icon={<Users size={30} color={colors.labelSecondary} />} title="No hay mozos cargados" message="Creá usuarios con rol Mozo para poder repartir las mesas." />
        ) : (
          <>
            <Text variant="footnote" color="secondary">
              {mesa ? 'Se sugiere a quien menos trabajo tiene ahora; después, a quien recibió menos mesas en el turno.' : 'Mesas y comensales que atiende cada uno ahora, y cuántas recibió en las últimas 8 horas.'}
            </Text>
            <Group>
              {orden.map((m) => {
                const peso = m.mesasActivas * 3 + m.comensalesActivos;
                const esSugerido = sugerido?.id === m.id && !!mesa;
                const actual = asignadoId === m.id;
                const fila = (
                  <View style={styles.fila}>
                    <View style={[styles.avatar, { backgroundColor: actual ? colors.tint : colors.tintSoft }]}>
                      <Text variant="subhead" weight="700" style={{ color: actual ? colors.onTint : colors.tint }}>{iniciales(m.nombre)}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.titulo}>
                        <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>{m.nombre}</Text>
                        {esSugerido ? <View style={[styles.etiqueta, { backgroundColor: colors.tintSoft }]}><Sparkles size={12} color={colors.tint} /><Text variant="caption" weight="600" color="tint">Sugerido</Text></View> : null}
                        {actual ? <Check size={16} color={colors.tint} /> : null}
                      </View>
                      <Text variant="footnote" color="secondary">{`${m.mesasActivas} ${m.mesasActivas === 1 ? 'mesa' : 'mesas'} · ${m.comensalesActivos} comensales · ${m.asignadasEnTurno} en el turno`}</Text>
                      <View style={[styles.barra, { backgroundColor: colors.fill }]}>
                        <View style={[styles.relleno, { width: `${Math.max(4, (peso / maxPeso) * 100)}%`, backgroundColor: colors.tint }]} />
                      </View>
                    </View>
                  </View>
                );
                return mesa ? (
                  <PressableScale key={m.id} onPress={() => asignar.mutate(m.id)} accessibilityRole="button" accessibilityLabel={`Asignar a ${m.nombre}`} disabled={asignar.isPending} scaleTo={0.99}>{fila}</PressableScale>
                ) : (
                  <View key={m.id}>{fila}</View>
                );
              })}
            </Group>
            {mesa && asignadoId ? <Button label="Quitar mozo de la mesa" variant="plain" icon={<UserMinus size={16} color={colors.tint} />} loading={asignar.isPending} onPress={() => asignar.mutate(null)} /> : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.md, paddingBottom: space.lg },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  etiqueta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  barra: { height: 6, borderRadius: 3, overflow: 'hidden' },
  relleno: { height: 6, borderRadius: 3 },
});
