import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Banknote, Check, CreditCard, Landmark, QrCode, Receipt } from 'lucide-react-native';
import { calcularCuenta, dividirEnPartesIguales, formatearARS, type ItemCuenta, type Propina } from '@vase/domain';
import { Button, EmptyState, Group, Row, Screen, Segmented, Skeleton, Stepper, Text, haptic, space, tabular, useTheme } from '@vase/ui';
import { usePedidosActivos } from '@/lib/queries';

type Division = 'entera' | 'iguales';
type Medio = 'efectivo' | 'tarjeta' | 'transferencia' | 'mercadopago';
const PROPINAS = [
  { value: '0', label: 'Sin' },
  { value: '10', label: '10 %' },
  { value: '15', label: '15 %' },
  { value: '20', label: '20 %' },
] as const;

export default function Cobro() {
  const { mesaId } = useLocalSearchParams<{ mesaId?: string }>();
  const router = useRouter();
  const { colors, sizeClass } = useTheme();
  const pedidosQ = usePedidosActivos();
  const [propinaPct, setPropinaPct] = useState<string>('10');
  const [division, setDivision] = useState<Division>('entera');
  const [personas, setPersonas] = useState(2);
  const [medio, setMedio] = useState<Medio>('efectivo');

  const conItems = useMemo(() => (pedidosQ.data ?? []).filter((p) => p.items.length > 0), [pedidosQ.data]);
  const pedido = conItems.find((p) => p.mesaId === mesaId) ?? null;

  const items: ItemCuenta[] = useMemo(
    () => (pedido?.items ?? []).map((i) => ({ id: i.id, nombre: i.nombre, cantidad: i.cantidad, precioUnitario: i.precioUnitario })),
    [pedido],
  );
  const propina: Propina = Number(propinaPct) > 0 ? { tipo: 'porcentaje', valor: Number(propinaPct) } : { tipo: 'ninguna' };
  const cuenta = useMemo(() => calcularCuenta(items, { impuestos: pedido?.impuestos ?? 0, propina }), [items, pedido, propina]);
  const partes = useMemo(() => (division === 'iguales' ? dividirEnPartesIguales(cuenta.total, personas) : []), [cuenta.total, division, personas]);

  const base = sizeClass === 'compact' ? 72 : 0;

  if (pedidosQ.isPending) {
    return <Screen title="Cobro" bottomInset={base}><Skeleton height={260} rounded={18} /></Screen>;
  }

  if (!pedido) {
    return (
      <Screen title="Cobro" subtitle={conItems.length ? 'Elegí la mesa a cobrar' : undefined} bottomInset={base}>
        {conItems.length === 0 ? (
          <EmptyState icon={<Receipt size={30} color={colors.labelSecondary} />} title="No hay cuentas para cobrar" message="Cuando una mesa tenga pedidos, su cuenta aparece acá." />
        ) : (
          <Group>
            {conItems.map((p) => (
              <Row key={p.id} title={`Mesa ${p.mesaNumero}`} subtitle={`${p.items.length} ${p.items.length === 1 ? 'ítem' : 'ítems'} · ${p.zona}`} value={formatearARS(p.total, true)} chevron onPress={() => router.setParams({ mesaId: p.mesaId })} />
            ))}
          </Group>
        )}
      </Screen>
    );
  }

  const medios: Array<{ id: Medio; titulo: string; icono: typeof Banknote; nota?: string; disponible: boolean }> = [
    { id: 'efectivo', titulo: 'Efectivo', icono: Banknote, disponible: true },
    { id: 'tarjeta', titulo: 'Tarjeta', icono: CreditCard, disponible: true },
    { id: 'transferencia', titulo: 'Transferencia', icono: Landmark, disponible: true },
    { id: 'mercadopago', titulo: 'QR Mercado Pago', icono: QrCode, nota: 'Falta conectar la cuenta', disponible: false },
  ];

  return (
    <Screen
      title={`Mesa ${pedido.mesaNumero}`}
      subtitle={pedido.comensales ? `Cuenta · ${pedido.comensales} comensales` : `Cuenta · ${pedido.zona}`}
      headerRight={<Button label="Otra mesa" size="sm" variant="tinted" onPress={() => router.setParams({ mesaId: '' })} />}
      bottomInset={base}
    >
      <Group header="Consumo">
        {pedido.items.map((item) => (
          <Row key={item.id} title={`${item.cantidad} × ${item.nombre}`} value={formatearARS(item.subtotal, true)} />
        ))}
      </Group>

      <View style={styles.bloque}>
        <Text variant="footnote" color="secondary" style={styles.etiqueta}>Propina</Text>
        <Segmented items={PROPINAS} value={propinaPct} onChange={setPropinaPct} accessibilityLabel="Propina" />
      </View>

      <View style={styles.bloque}>
        <Text variant="footnote" color="secondary" style={styles.etiqueta}>Dividir</Text>
        <Segmented<Division> items={[{ value: 'entera', label: 'Cuenta entera' }, { value: 'iguales', label: 'Partes iguales' }]} value={division} onChange={setDivision} accessibilityLabel="División de la cuenta" />
        {division === 'iguales' ? (
          <Group>
            <Row title="Personas" trailing={<Stepper value={personas} min={2} max={20} onChange={setPersonas} label="personas" />} />
            {partes.map((parte) => (
              <Row key={parte.indice} title={`Persona ${parte.indice + 1}`} value={formatearARS(parte.total)} />
            ))}
          </Group>
        ) : null}
      </View>

      <Group header="Medio de pago">
        {medios.map(({ id, titulo, icono: Icono, nota, disponible }) => (
          <Row
            key={id}
            title={titulo}
            subtitle={nota}
            leading={<Icono size={22} color={disponible ? colors.tint : colors.labelTertiary} />}
            trailing={medio === id ? <Check size={20} color={colors.tint} strokeWidth={2.8} /> : null}
            onPress={disponible ? () => { haptic.seleccion(); setMedio(id); } : undefined}
          />
        ))}
      </Group>

      <View style={[styles.total, { backgroundColor: colors.surface }]}>
        <TotalRow label="Subtotal" valor={formatearARS(cuenta.subtotal)} />
        {cuenta.impuestos > 0 ? <TotalRow label="IVA 21 %" valor={formatearARS(cuenta.impuestos)} /> : null}
        {cuenta.propina > 0 ? <TotalRow label={`Propina ${propinaPct} %`} valor={formatearARS(cuenta.propina)} /> : null}
        <View style={[styles.linea, { backgroundColor: colors.separator }]} />
        <View style={styles.totalFila}>
          <Text variant="title3" weight="700">Total</Text>
          <Text variant="title1" numeric weight="700" accessibilityLabel={`Total ${formatearARS(cuenta.total)}`}>{formatearARS(cuenta.total)}</Text>
        </View>
      </View>

      <View style={styles.bloque}>
        <Button label={`Cobrar ${formatearARS(division === 'iguales' && partes[0] ? partes[0].total : cuenta.total, true)}`} size="lg" full disabled />
        <Text variant="footnote" color="secondary" align="center">El registro del cobro y la factura ARCA se activan en la fase 4 del plan.</Text>
      </View>
    </Screen>
  );
}

function TotalRow({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={styles.totalFila}>
      <Text variant="body" color="secondary">{label}</Text>
      <Text variant="body" numeric style={tabular}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: space.sm },
  etiqueta: { paddingHorizontal: space.lg + space.xs },
  total: { borderRadius: 18, padding: space.xl, gap: space.md, borderCurve: 'continuous' },
  totalFila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  linea: { height: StyleSheet.hairlineWidth, marginVertical: space.xs },
});
