import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, DoorOpen, Printer, XCircle } from 'lucide-react-native';
import { comprobantesRecientes, obtenerTicket, verificarSalida, type ResultadoSalida } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { imprimir } from '@/lib/carta';
import { htmlTicket } from '@/lib/ticket';
import { Button, Group, PressableScale, Row, Screen, Text, fontFor, haptic, radius, space, useTheme } from '@vase/ui';

const hora = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '');

/** Control de salida: quien está en la puerta escanea el QR del comprobante (o escribe el código) y ve si está pagado. */
export default function Salida() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  const { colors, sizeClass } = useTheme();
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState(c ?? '');
  const [resultado, setResultado] = useState<ResultadoSalida | null>(null);
  const recientes = useQuery({ queryKey: ['salida-recientes'], queryFn: comprobantesRecientes, refetchInterval: 15000 });

  const verificar = useMutation({
    mutationFn: (cod: string) => verificarSalida(cod),
    onSuccess: (r) => { setResultado(r); if (r.valido && !r.repetido) haptic.exito(); else haptic.error(); void queryClient.invalidateQueries({ queryKey: ['salida-recientes'] }); },
    onError: () => haptic.error(),
  });
  // Si el QR abrió la app con el código en la dirección, se verifica solo.
  useEffect(() => { if (c) { setCodigo(c); verificar.mutate(c); } }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const reimprimir = useMutation({ mutationFn: async (cod: string) => imprimir(htmlTicket(await obtenerTicket(cod))) });
  const k = resultado?.comprobante;
  const estado = !resultado ? null : resultado.valido ? (resultado.repetido ? 'repetido' : 'ok') : 'mal';
  const color = estado === 'ok' ? colors.tint : estado === 'repetido' ? colors.warning : colors.danger;
  const fondo = estado === 'ok' ? colors.tintSoft : estado === 'repetido' ? 'rgba(240,176,74,0.18)' : colors.dangerSoft;

  const titulo = estado === 'ok' ? 'PAGADO' : estado === 'repetido' ? 'YA SE MOSTRÓ' : resultado?.motivo === 'pendiente' ? 'PAGO SIN CONFIRMAR' : resultado?.motivo === 'vencido' ? 'PAGO VENCIDO' : resultado?.motivo === 'rechazado' ? 'PAGO RECHAZADO' : 'NO EXISTE';
  const detalle = estado === 'ok' ? 'Puede salir.' : estado === 'repetido' ? `Este comprobante ya se verificó a las ${hora(resultado?.primeraVez)}${resultado?.verificadoPor ? ` (${resultado.verificadoPor})` : ''}. Confirmá que sea la misma persona.` : resultado?.motivo === 'pendiente' ? 'Todavía no se confirmó el pago. Pedile que espere al mozo o a la caja.' : resultado?.motivo === 'no_existe' ? 'Ese código no corresponde a ningún pago. Revisá que esté bien escrito.' : 'No sirve para salir. Derivalo a la caja.';

  return (
    <Screen title="Salida" subtitle="Verificá que pagaron antes de que se vayan" bottomInset={sizeClass === 'compact' ? 72 : 0}>
      <View style={styles.pila}>
        <View style={[styles.barra, { backgroundColor: colors.fill }]}>
          <TextInput
            value={codigo}
            onChangeText={(t) => setCodigo(t.toUpperCase())}
            placeholder="Código del comprobante (ABCD-1234)"
            placeholderTextColor={colors.labelSecondary}
            selectionColor={colors.tint}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Código del comprobante"
            returnKeyType="go"
            onSubmitEditing={() => codigo.trim() && verificar.mutate(codigo)}
            style={[styles.input, fontFor('600'), { color: colors.label }]}
          />
          <Button label="Verificar" loading={verificar.isPending} disabled={!codigo.trim()} onPress={() => verificar.mutate(codigo)} />
        </View>
        <Text variant="footnote" color="secondary" style={{ paddingHorizontal: space.sm }}>
          Con la cámara del celular: escaneá el QR del comprobante y se abre esta pantalla con el resultado.
        </Text>

        {resultado && estado ? (
          <View style={[styles.resultado, { backgroundColor: fondo, borderColor: color }]} accessibilityRole="alert">
            {estado === 'ok' ? <CheckCircle2 size={64} color={color} /> : estado === 'repetido' ? <AlertTriangle size={64} color={color} /> : <XCircle size={64} color={color} />}
            <Text variant="largeTitle" weight="700" align="center" style={{ color }}>{titulo}</Text>
            <Text variant="callout" align="center">{detalle}</Text>
            {k ? (
              <View style={styles.datos}>
                <Text variant="headline" numeric>{`${k.mesa ? `Mesa ${k.mesa} · ` : ''}${formatearARS(k.total, true)}`}</Text>
                <Text variant="footnote" color="secondary">{`${k.codigo}${k.pagadoEn ? ` · pagado ${hora(k.pagadoEn)}` : ''}`}</Text>
                {resultado.valido ? <Button label="Imprimir ticket" size="sm" variant="tinted" icon={<Printer size={16} color={colors.tint} />} loading={reimprimir.isPending} onPress={() => reimprimir.mutate(k.codigo)} /> : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {reimprimir.isError ? <Text variant="callout" color="danger" align="center">{reimprimir.error instanceof Error ? reimprimir.error.message : 'No se pudo imprimir'}</Text> : null}
        {verificar.isError ? <Text variant="callout" color="danger" align="center">{verificar.error instanceof Error ? verificar.error.message : 'No se pudo verificar'}</Text> : null}

        <Group header="Pagos de las últimas horas" footer="Si alguien no puede mostrar el QR, buscalo acá por mesa e importe.">
          {(recientes.data ?? []).length === 0 ? (
            <Row title="Todavía no hay pagos por QR" leading={<DoorOpen size={20} color={colors.labelSecondary} />} />
          ) : (
            (recientes.data ?? []).map((r) => (
              <Row
                key={r.codigo}
                title={`${r.mesa ? `Mesa ${r.mesa}` : 'Mesa'} · ${formatearARS(r.total, true)}`}
                subtitle={`${r.codigo} · ${hora(r.pagadoEn)}${r.verificado ? ' · ya verificado' : ''}`}
                chevron
                onPress={() => { setCodigo(r.codigo); verificar.mutate(r.codigo); }}
              />
            ))
          )}
        </Group>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pila: { gap: space.lg },
  barra: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs, paddingLeft: space.lg, borderRadius: radius.pill },
  input: { flex: 1, minWidth: 0, fontSize: 18, paddingVertical: space.md, letterSpacing: 1, outlineStyle: 'none' as never },
  resultado: { alignItems: 'center', gap: space.sm, padding: space.xxl, borderRadius: radius.xl, borderWidth: 2, borderCurve: 'continuous' },
  datos: { alignItems: 'center', gap: 2, marginTop: space.sm },
});
