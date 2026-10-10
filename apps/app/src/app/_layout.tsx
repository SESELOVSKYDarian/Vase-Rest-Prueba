import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from '@vase/ui';
import { queryClient } from '@/lib/queries';
import { conectarApiConSesion, useSession } from '@/lib/session';

void SplashScreen.preventAutoHideAsync();
conectarApiConSesion();

function Shell() {
  const token = useSession((s) => s.token);
  const { colors, dark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
        <Stack.Protected guard={!!token}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="editor-plano" options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
          <Stack.Screen name="qr-mesas" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ajustes-carta" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
        {/* La carta del QR es pública: la abre cualquiera, con o sin sesión. */}
        <Stack.Screen name="carta" />
        <Stack.Screen name="reservar" />
        <Stack.Protected guard={!token}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const hidratado = useSession((s) => s.hidratado);
  const tema = useSession((s) => s.tema);
  const [fuentes, errorFuentes] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  // Si una fuente falla o tarda, la app arranca igual con la tipografía del sistema (nunca queda en blanco).
  const listo = hidratado && (fuentes || !!errorFuentes);

  useEffect(() => { if (listo) void SplashScreen.hideAsync(); }, [listo]);
  if (!listo) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider mode={tema}>
            <Shell />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
