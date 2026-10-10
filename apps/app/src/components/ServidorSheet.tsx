import { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { normalizarUrlServidor, probarServidor } from '@vase/api';
import { Button, Field, Group, Sheet, Text, space, useTheme } from '@vase/ui';
import { urlServidorPorDefecto, useSession } from '@/lib/session';

/**
 * El servidor del local: en la nube o una PC de la red interna (para que el salón siga
 * funcionando sin internet). Se prueba antes de guardar.
 */
export function ServidorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const servidorActual = useSession((s) => s.servidor);
  const setServidor = useSession((s) => s.setServidor);
  const [texto, setTexto] = useState(servidorActual);
  const [estado, setEstado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [probando, setProbando] = useState(false);

  const url = normalizarUrlServidor(texto) || urlServidorPorDefecto();

  const probar = async () => {
    Keyboard.dismiss();
    setProbando(true);
    setEstado(await probarServidor(url));
    setProbando(false);
  };

  const guardar = () => {
    setServidor(normalizarUrlServidor(texto));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Servidor"
      footer={<Button label="Guardar" size="lg" full onPress={guardar} disabled={estado?.ok === false} />}
    >
      <View style={styles.body}>
        <Text variant="callout" color="secondary">
          Dirección del equipo que guarda los datos del local. Si lo dejás vacío se usa la de este dispositivo.
        </Text>
        <Group footer={`Se conectará a ${url}`}>
          <Field
            label="Dirección"
            value={texto}
            onChangeText={(valor) => { setTexto(valor); setEstado(null); }}
            placeholder="192.168.0.10"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={probar}
          />
        </Group>
        <Button label="Probar conexión" variant="tinted" loading={probando} onPress={probar} full />
        {estado ? (
          <View style={styles.result} accessibilityLiveRegion="polite">
            {estado.ok ? <CheckCircle2 size={20} color={colors.tint} /> : <XCircle size={20} color={colors.danger} />}
            <Text variant="subhead" color={estado.ok ? 'tint' : 'danger'} style={{ flex: 1 }}>{estado.mensaje}</Text>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingBottom: space.sm },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
