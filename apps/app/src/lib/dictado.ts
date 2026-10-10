import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictado por voz gratuito: usa el reconocimiento del propio dispositivo (Android/iOS) o del navegador
 * (Chrome, Edge, Safari). No manda audio a ningún servicio nuestro. En Expo Go o navegadores sin soporte
 * el botón de micrófono simplemente no aparece y se escribe.
 */
type Modulo = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

let modulo: Modulo | null = null;
try {
  // Carga perezosa: si el módulo nativo no está en esta compilación, la app sigue funcionando sin voz.
  modulo = require('expo-speech-recognition').ExpoSpeechRecognitionModule as Modulo;
} catch {
  modulo = null;
}

const LOCALES = { es: 'es-AR', en: 'en-US', pt: 'pt-BR' } as const;

export function useDictado(idioma: 'es' | 'en' | 'pt' = 'es') {
  const [disponible, setDisponible] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const alTerminar = useRef<((texto: string) => void) | null>(null);
  const ultimo = useRef('');

  useEffect(() => {
    try { setDisponible(!!modulo && modulo.isRecognitionAvailable()); } catch { setDisponible(false); }
  }, []);

  useEffect(() => {
    if (!modulo) return;
    const subs = [
      modulo.addListener('start', () => { setEscuchando(true); setError(null); }),
      modulo.addListener('end', () => {
        setEscuchando(false);
        const final = ultimo.current.trim();
        if (final) alTerminar.current?.(final);
      }),
      modulo.addListener('result', (e) => {
        const t = e.results?.[0]?.transcript ?? '';
        ultimo.current = t;
        setTexto(t);
      }),
      modulo.addListener('error', (e) => {
        setEscuchando(false);
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        setError(e.error === 'not-allowed' ? 'Hace falta permitir el micrófono.' : 'No pude escuchar. Probá de nuevo o escribilo.');
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  /** Empieza a escuchar; cuando la persona termina de hablar llama a `cuandoTermina` con lo dictado. */
  const empezar = useCallback(async (cuandoTermina?: (texto: string) => void) => {
    if (!modulo) return;
    alTerminar.current = cuandoTermina ?? null;
    ultimo.current = '';
    setTexto('');
    setError(null);
    const permiso = await modulo.requestPermissionsAsync();
    if (!permiso.granted) { setError('Hace falta permitir el micrófono.'); return; }
    modulo.start({ lang: LOCALES[idioma], interimResults: true, continuous: false });
  }, [idioma]);

  const parar = useCallback(() => { try { modulo?.stop(); } catch { /* ya estaba parado */ } }, []);

  return { disponible, escuchando, texto, error, empezar, parar };
}
