import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Server } from 'lucide-react-native';
import { Button, ErrorBanner, Field, Group, Text, haptic, space, useTheme } from '@vase/ui';
import { ServidorSheet } from '@/components/ServidorSheet';
import { useSession } from '@/lib/session';

const ENTRADA = Easing.bezier(0.23, 1, 0.32, 1);

export default function Login() {
  const { colors, sizeClass } = useTheme();
  const insets = useSafeAreaInsets();
  const entrar = useSession((s) => s.entrar);
  const cargando = useSession((s) => s.cargando);
  const error = useSession((s) => s.error);
  const limpiarError = useSession((s) => s.limpiarError);
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [servidorAbierto, setServidorAbierto] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const puedeEnviar = usuario.trim().length > 0 && password.length > 0 && !cargando;

  const enviar = async () => {
    if (!puedeEnviar) return;
    const ok = await entrar(usuario, password);
    if (ok) haptic.exito(); else haptic.error();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space['5xl'], paddingBottom: insets.bottom + space['3xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(320).easing(ENTRADA)} style={[styles.card, sizeClass !== 'compact' && styles.cardWide]}>
          <View style={styles.head}>
            <View style={[styles.mark, { backgroundColor: colors.tint }]}>
              <Text variant="title2" color="onTint" weight="700">V</Text>
            </View>
            <Text variant="largeTitle" accessibilityRole="header">Vase Rest</Text>
            <Text variant="callout" color="secondary">Iniciá sesión para empezar el servicio.</Text>
          </View>

          <Group>
            <Field
              label="Usuario"
              value={usuario}
              onChangeText={(valor) => { setUsuario(valor); if (error) limpiarError(); }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="tu usuario"
            />
            <Field
              ref={passwordRef}
              label="Contraseña"
              value={password}
              onChangeText={(valor) => { setPassword(valor); if (error) limpiarError(); }}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={enviar}
              placeholder="Tu contraseña"
            />
          </Group>

          {error ? <ErrorBanner message={error} /> : null}

          <Button label="Entrar" size="lg" full loading={cargando} disabled={!puedeEnviar} onPress={enviar} />
          <Button label="Servidor" variant="plain" icon={<Server size={18} color={colors.tint} />} onPress={() => setServidorAbierto(true)} />
        </Animated.View>
      </ScrollView>
      <ServidorSheet open={servidorAbierto} onClose={() => setServidorAbierto(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: space.xl },
  card: { width: '100%', maxWidth: 420, gap: space.xl },
  cardWide: { marginTop: space['4xl'] },
  head: { gap: space.sm, marginBottom: space.md, alignItems: 'flex-start' },
  mark: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: space.md, borderCurve: 'continuous' },
});
