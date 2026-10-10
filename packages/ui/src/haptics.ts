import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Una sola vibración por acción del usuario, siempre acompañada de un cambio visual. Sin efecto en web. */
const activo = Platform.OS !== 'web';

export const haptic = {
  /** Un valor cambia de paso (segmentado, selector). */
  seleccion: () => { if (activo) void Haptics.selectionAsync(); },
  /** Algo encaja: hoja en su lugar, mesa soltada, acción confirmada. */
  ligero: () => { if (activo) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  /** Algo pesado o destructivo. */
  medio: () => { if (activo) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  exito: () => { if (activo) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  error: () => { if (activo) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
};
