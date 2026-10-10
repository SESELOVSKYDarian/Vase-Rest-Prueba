import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ImagePlus, Sparkles } from 'lucide-react-native';
import { analizarPlano } from '@vase/api';
import { planoDesdeAnalisis, type Mesa, type Plano } from '@vase/domain';
import { Button, ErrorBanner, Group, Row, Sheet, Text, haptic, radius, space, useTheme } from '@vase/ui';
import { elegirYSubirImagen } from '@/lib/imagenes';
import { PlanoCanvas } from './PlanoCanvas';

interface Props {
  open: boolean;
  onClose: () => void;
  plano: Plano;
  mesas: readonly Mesa[];
  onAplicar: (plano: Plano, numeros: Record<string, number>) => void;
}

type Paso = { tipo: 'inicio' } | { tipo: 'analizando' } | { tipo: 'listo'; plano: Plano; numeros: Record<string, number>; notas: string } | { tipo: 'error'; mensaje: string };

/** Subir el plano del local y dejar que la IA proponga mesas, zonas y elementos; siempre se revisa antes de aplicar. */
export function AnalizarPlanoSheet({ open, onClose, plano, mesas, onAplicar }: Props) {
  const { colors } = useTheme();
  const [paso, setPaso] = useState<Paso>({ tipo: 'inicio' });

  const cerrar = () => { setPaso({ tipo: 'inicio' }); onClose(); };

  const analizar = async (url: string) => {
    setPaso({ tipo: 'analizando' });
    try {
      const analisis = await analizarPlano(url);
      if (!analisis.es_plano || (analisis.mesas.length === 0 && analisis.zonas.length === 0)) {
        haptic.error();
        setPaso({ tipo: 'error', mensaje: 'No reconocimos un plano en esa imagen. Probá con un dibujo o plano visto desde arriba.' });
        return;
      }
      const { plano: nuevo, numeros } = planoDesdeAnalisis(analisis, mesas, { url, opacidad: 0.35 });
      haptic.exito();
      setPaso({ tipo: 'listo', plano: nuevo, numeros, notas: analisis.notas });
    } catch (e) {
      haptic.error();
      setPaso({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo analizar el plano' });
    }
  };

  const elegir = async () => {
    try {
      const url = await elegirYSubirImagen({ anchoMax: 2400, calidad: 0.88 });
      if (url) await analizar(url);
    } catch (e) {
      setPaso({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo subir la imagen' });
    }
  };

  return (
    <Sheet
      open={open}
      onClose={cerrar}
      title="Armar el plano con IA"
      footer={
        paso.tipo === 'listo' ? (
          <View style={styles.acciones}>
            <Button label="Usar este plano" size="lg" full onPress={() => { onAplicar(paso.plano, paso.numeros); setPaso({ tipo: 'inicio' }); }} />
            <Button label="Probar con otra imagen" variant="plain" onPress={elegir} />
          </View>
        ) : paso.tipo === 'inicio' || paso.tipo === 'error' ? (
          <View style={styles.acciones}>
            <Button label="Elegir imagen del plano" size="lg" full icon={<ImagePlus size={20} color={colors.onTint} />} onPress={elegir} />
            {plano.fondo ? <Button label="Usar la imagen de fondo actual" variant="tinted" full onPress={() => analizar(plano.fondo!.url)} /> : null}
          </View>
        ) : undefined
      }
    >
      <View style={styles.cuerpo}>
        {paso.tipo === 'inicio' ? (
          <>
            <View style={[styles.icono, { backgroundColor: colors.tintSoft }]}><Sparkles size={28} color={colors.tint} /></View>
            <Text variant="callout" color="secondary">
              Subí el plano del arquitecto, un dibujo a mano o una foto tomada desde arriba. Detectamos mesas, sillas, zonas, barra, puertas y paredes, y te mostramos el resultado antes de aplicarlo.
            </Text>
            <Text variant="footnote" color="secondary">Funciona mejor con fondo claro, líneas marcadas y una sola sala por imagen. Reemplaza lo que tengas dibujado ahora (podés deshacer).</Text>
          </>
        ) : null}
        {paso.tipo === 'analizando' ? (
          <View style={styles.cargando} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.tint} size="large" />
            <Text variant="headline" align="center">Leyendo el plano…</Text>
            <Text variant="footnote" color="secondary" align="center">Suele tardar entre 20 y 60 segundos.</Text>
          </View>
        ) : null}
        {paso.tipo === 'error' ? <ErrorBanner message={paso.mensaje} /> : null}
        {paso.tipo === 'listo' ? (
          <>
            <View style={[styles.vista, { borderColor: colors.separator }]}>
              <PlanoCanvas plano={paso.plano} info={(id) => ({ numero: paso.numeros[id] ?? 0, estado: 'libre' })} modo="servicio" />
            </View>
            <Group>
              <Row title="Mesas" value={`${paso.plano.mesas.length} · ${paso.plano.mesas.reduce((s, m) => s + m.asientos, 0)} lugares`} />
              <Row title="Zonas" value={paso.plano.zonas.map((z) => z.nombre).join(', ') || '—'} />
              <Row title="Tamaño" value={`${(paso.plano.ancho / 100).toLocaleString('es-AR')} × ${(paso.plano.alto / 100).toLocaleString('es-AR')} m`} />
            </Group>
            {paso.notas ? <Text variant="footnote" color="secondary">{paso.notas}</Text> : null}
          </>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.lg, paddingBottom: space.sm },
  acciones: { gap: space.sm },
  icono: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  cargando: { alignItems: 'center', gap: space.md, paddingVertical: space['3xl'] },
  vista: { height: 260, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
