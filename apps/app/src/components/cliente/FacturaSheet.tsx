import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pedirFactura, type CondicionIva, type Idioma, type TipoDocumento } from '@vase/api';
import { Button, ErrorBanner, Field, Group, Segmented, Sheet, Text, haptic, space } from '@vase/ui';
import { textosFactura } from '@/lib/i18nFactura';

interface Props { open: boolean; onClose: () => void; codigo: string; idioma: Idioma; condicionEmisor: string }

/** Formulario de datos fiscales del cliente. El tipo de factura lo decide el servidor según quién es quién. */
export function FacturaSheet({ open, onClose, codigo, idioma, condicionEmisor }: Props) {
  const t = textosFactura(idioma);
  const queryClient = useQueryClient();
  const [condicion, setCondicion] = useState<CondicionIva>('consumidor_final');
  const [docTipo, setDocTipo] = useState<TipoDocumento>('DNI');
  const [docNumero, setDocNumero] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [domicilio, setDomicilio] = useState('');

  const enviar = useMutation({
    mutationFn: () => pedirFactura(codigo, { condicionIva: condicion, docTipo, docNumero, nombre, email, domicilio }),
    onSuccess: async () => { haptic.exito(); await queryClient.invalidateQueries({ queryKey: ['ticket', codigo] }); onClose(); },
    onError: () => haptic.error(),
  });

  // Mismo criterio que el servidor, solo para avisar de antemano qué factura va a recibir.
  const tipo = condicionEmisor === 'monotributo' ? 'C' : condicion === 'responsable_inscripto' ? 'A' : 'B';
  const cambiarCondicion = (c: CondicionIva) => { setCondicion(c); if (c === 'responsable_inscripto') setDocTipo('CUIT'); else if (docTipo === 'CUIT' && c === 'consumidor_final') setDocTipo('DNI'); };

  return (
    <Sheet open={open} onClose={onClose} title={t.facturaTitulo}>
      <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text variant="callout" color="secondary">{t.facturaIntro}</Text>
        <Group header={t.condicion}>
          <View style={styles.bloque}>
            <Segmented
              accessibilityLabel={t.condicion}
              items={[{ value: 'consumidor_final', label: t.consumidorFinal }, { value: 'responsable_inscripto', label: t.responsableInscripto }]}
              value={condicion === 'responsable_inscripto' ? 'responsable_inscripto' : 'consumidor_final'}
              onChange={cambiarCondicion}
            />
          </View>
          <View style={styles.bloque}>
            <Segmented
              accessibilityLabel={t.documento}
              items={[{ value: 'DNI', label: 'DNI' }, { value: 'CUIT', label: 'CUIT' }, { value: 'CUIL', label: 'CUIL' }]}
              value={docTipo}
              onChange={setDocTipo}
            />
          </View>
          <Field label={t.numeroDoc} value={docNumero} onChangeText={setDocNumero} keyboardType="number-pad" placeholder={docTipo === 'DNI' ? '30123456' : '20-12345678-6'} />
          <Field label={t.nombre} value={nombre} onChangeText={setNombre} autoComplete="name" />
          <Field label={t.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
          <Field label={t.domicilio} value={domicilio} onChangeText={setDomicilio} autoComplete="street-address" />
        </Group>
        <Text variant="footnote" color="secondary" align="center">{t.tipoQueCorresponde(tipo)}</Text>
        {enviar.isError ? <ErrorBanner message={enviar.error instanceof Error ? enviar.error.message : '—'} /> : null}
        <Button label={t.enviarPedido} size="lg" full loading={enviar.isPending} onPress={() => enviar.mutate()} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.lg, paddingBottom: space.xl },
  bloque: { padding: space.md },
});
