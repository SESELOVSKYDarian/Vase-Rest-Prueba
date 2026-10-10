import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

/** El token va al llavero seguro del sistema en celular; en web/escritorio, a localStorage. */
export const secureStorage: StateStorage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      try { globalThis.localStorage?.setItem(key, value); } catch { /* almacenamiento bloqueado */ }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      try { globalThis.localStorage?.removeItem(key); } catch { /* idem */ }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
