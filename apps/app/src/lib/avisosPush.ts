import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { quitarDispositivoPush, registrarDispositivoPush } from '@vase/api';
import { useSession } from './session';

/**
 * Avisos en la pantalla bloqueada ("Mesa 5 · listo para servir").
 * Necesitan la app instalada (compilación con `eas build`, no Expo Go) y el proyecto vinculado en Expo:
 * sin eso la app funciona igual, solo que sin avisos del sistema. En la web no existen.
 */
export type EstadoPush = 'activo' | 'denegado' | 'sin-proyecto' | 'no-disponible';

// El módulo nativo se carga solo donde existe: en la web o en una compilación sin él, todo sigue andando.
type Notificaciones = typeof import('expo-notifications');
let modulo: Notificaciones | null | undefined;
function notificaciones(): Notificaciones | null {
  if (modulo !== undefined) return modulo;
  try {
    modulo = Platform.OS === 'web' ? null : (require('expo-notifications') as Notificaciones);
  } catch {
    modulo = null;
  }
  return modulo;
}

let tokenActual: string | null = null;
let manejadorListo = false;

function prepararManejador(N: Notificaciones) {
  if (manejadorListo) return;
  manejadorListo = true;
  // Con la app abierta también se muestra y suena: el mozo puede estar en otra pantalla.
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function activarAvisosPush(): Promise<EstadoPush> {
  const N = notificaciones();
  if (!N) return 'no-disponible';
  try {
    prepararManejador(N);
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('servicio', {
        name: 'Avisos del salón',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 200, 250],
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
      });
    }
    let permiso = await N.getPermissionsAsync();
    if (!permiso.granted && permiso.canAskAgain) permiso = await N.requestPermissionsAsync();
    if (!permiso.granted) return 'denegado';
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'sin-proyecto';
    const { data } = await N.getExpoPushTokenAsync({ projectId });
    await registrarDispositivoPush(data, Platform.OS);
    tokenActual = data;
    return 'activo';
  } catch {
    return 'no-disponible';
  }
}

/** Cierra la sesión sacando antes este celular de la lista, para que no reciba avisos de otra persona. */
export async function cerrarSesionConPush() {
  const token = tokenActual;
  tokenActual = null;
  if (token) { try { await quitarDispositivoPush(token); } catch { /* sin conexión: el servidor lo reasigna en el próximo ingreso */ } }
  useSession.getState().salir();
}

/** Registra el celular al iniciar sesión y lleva al salón cuando se toca un aviso. */
export function useAvisosPush() {
  const router = useRouter();
  const logueado = useSession((s) => !!s.token);
  useEffect(() => {
    if (!logueado) return;
    void activarAvisosPush();
  }, [logueado]);
  useEffect(() => {
    const N = notificaciones();
    if (!N) return;
    const sub = N.addNotificationResponseReceivedListener(() => { router.navigate('/salon'); });
    return () => sub.remove();
  }, [router]);
}
