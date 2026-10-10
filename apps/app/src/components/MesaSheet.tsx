import { StyleSheet, View } from 'react-native';
import { ETIQUETA_ESTADO_MESA, formatearARS, tiempoTranscurrido, type AlertaMesa, type Mesa } from '@vase/domain';
import type { Pedido } from '@vase/api';
import { Button, Group, Row, Sheet, StatusPill, Text, space, useTheme } from '@vase/ui';
import { Users } from 'lucide-react-native';

interface Props {
  mesa: Mesa | null;
  pedido: Pedido | null;
  onClose: () => void;
  onTomarPedido: (mesa: Mesa) => void;
  onCobrar: (mesa: Mesa) => void;
  /** Por qué la mesa está demorada, si lo está. */
  alerta?: AlertaMesa | null;
  /** Mozo asignado (explícito o el que abrió el pedido). */
  mozoNombre?: string | null;
  onElegirMozo?: (mesa: Mesa) => void;
}

/** Todo lo de una mesa en una hoja: estado, quién la atiende, cuánto lleva y qué hacer ahora. */
export function MesaSheet({ mesa, pedido, onClose, onTomarPedido, onCobrar, alerta, mozoNombre, onElegirMozo }: Props) {
  const { colors } = useTheme();
  const conItems = !!pedido && pedido.items.length > 0;
  return (
    <Sheet
      open={!!mesa}
      onClose={onClose}
      title={mesa ? `Mesa ${mesa.numero}` : undefined}
      footer={
        mesa ? (
          <View style={styles.acciones}>
            <Button label={pedido ? 'Seguir pedido' : 'Tomar pedido'} size="lg" full onPress={() => onTomarPedido(mesa)} />
            {conItems ? <Button label="Cobrar" size="lg" variant="tinted" full onPress={() => onCobrar(mesa)} /> : null}
          </View>
        ) : undefined
      }
    >
      {mesa ? (
        <View style={styles.body}>
          <StatusPill estado={mesa.estado} />
          {alerta && alerta.nivel !== 'ok' ? <Text variant="callout" weight="600" style={{ color: alerta.nivel === 'urgente' ? colors.danger : colors.warning }}>{alerta.motivo}</Text> : null}
          <Group>
            <Row title="Zona" value={mesa.zona} />
            <Row title="Lugares" value={String(mesa.capacidad)} />
            {pedido ? <Row title="Comensales" value={String(pedido.comensales || mesa.personas || '—')} /> : null}
            {mesa.estado !== 'libre' || pedido ? <Row title="Atiende" value={mozoNombre ?? pedido?.mozoNombre ?? 'Sin asignar'} leading={<Users size={18} color={colors.labelSecondary} />} chevron={!!onElegirMozo} onPress={onElegirMozo ? () => onElegirMozo(mesa) : undefined} /> : null}
            {pedido ? <Row title="Abierta" value={tiempoTranscurrido(pedido.abiertoEn)} /> : null}
            {pedido ? <Row title="Consumo" value={formatearARS(pedido.total, true)} /> : null}
            {!pedido ? <Row title="Estado" value={ETIQUETA_ESTADO_MESA[mesa.estado]} /> : null}
          </Group>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingBottom: space.sm },
  acciones: { gap: space.sm },
});
