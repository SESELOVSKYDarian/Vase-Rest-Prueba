import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, SlidersHorizontal, Undo2, X } from 'lucide-react-native';
import { crearMesa, guardarPlano, sincronizarMesasConPlano } from '@vase/api';
import { planoDesdeMesas, zonaDeMesa, type Mesa, type Plano } from '@vase/domain';
import { Button, ErrorBanner, PressableScale, Sheet, Text, Toast, haptic, radius, space, useTheme } from '@vase/ui';
import { AgregarSheet } from '@/components/plano/AgregarSheet';
import { AnalizarPlanoSheet } from '@/components/plano/AnalizarPlanoSheet';
import { InspectorScroll } from '@/components/plano/Inspector';
import { PlanoCanvas, type PlanoCanvasHandle } from '@/components/plano/PlanoCanvas';
import { useEditorPlano } from '@/components/plano/useEditorPlano';
import { elegirYSubirImagen } from '@/lib/imagenes';
import { useMesas, usePlano } from '@/lib/queries';

export default function EditorPlanoPantalla() {
  const mesasQ = useMesas();
  const planoQ = usePlano();
  const { colors } = useTheme();
  if (mesasQ.isPending || planoQ.isPending) {
    return <View style={[styles.centro, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.tint} /></View>;
  }
  if (mesasQ.isError || planoQ.isError) {
    return (
      <View style={[styles.centro, { backgroundColor: colors.bg, padding: space.xl }]}>
        <ErrorBanner message="No se pudo cargar el plano" action={<Button label="Reintentar" size="sm" variant="tinted" onPress={() => { void mesasQ.refetch(); void planoQ.refetch(); }} />} />
      </View>
    );
  }
  const inicial = planoQ.data ?? planoDesdeMesas(mesasQ.data);
  return <Editor inicial={inicial} mesas={mesasQ.data} provisorio={!planoQ.data} />;
}

function Editor({ inicial, mesas, provisorio }: { inicial: Plano; mesas: Mesa[]; provisorio: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors, sizeClass } = useTheme();
  const editor = useEditorPlano(inicial, mesas);
  const lienzo = useRef<PlanoCanvasHandle>(null);
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [inspectorAbierto, setInspectorAbierto] = useState(false);
  const [analizarAbierto, setAnalizarAbierto] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFondo, setSubiendoFondo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(provisorio ? 'Armamos un primer plano con tus mesas' : null);
  const ancho = sizeClass === 'expanded';

  const sinUbicar = useMemo(() => mesas.filter((m) => !editor.plano.mesas.some((x) => x.mesaId === m.id)), [mesas, editor.plano.mesas]);
  const info = (mesaId: string) => {
    const numero = editor.numeros[mesaId];
    return numero ? { numero, estado: 'libre' as const } : null;
  };
  const centro = () => lienzo.current?.centroVisible() ?? { x: editor.plano.ancho / 2, y: editor.plano.alto / 2 };

  const subirFondo = async () => {
    try {
      setSubiendoFondo(true);
      const url = await elegirYSubirImagen({ anchoMax: 2400, calidad: 0.85 });
      if (url) editor.cambiarPlano({ fondo: { url, opacidad: editor.plano.fondo?.opacidad ?? 0.5 } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen');
    } finally {
      setSubiendoFondo(false);
    }
  };

  const guardar = async () => {
    if (editor.repetidos.size > 0) {
      setError(`Hay mesas con el mismo número (${[...editor.repetidos].join(', ')}). Cambialas antes de guardar.`);
      haptic.error();
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      // 1) Mesas nuevas: se crean primero para tener su id real.
      const plano: Plano = { ...editor.plano, mesas: [...editor.plano.mesas] };
      for (let i = 0; i < plano.mesas.length; i++) {
        const m = plano.mesas[i];
        if (mesas.some((x) => x.id === m.mesaId)) continue;
        const zona = zonaDeMesa(plano, m)?.nombre ?? 'Salón';
        const id = await crearMesa({ numero: editor.numeros[m.mesaId], capacidad: m.asientos, zona, forma: m.forma });
        plano.mesas[i] = { ...m, mesaId: id };
      }
      // 2) El plano.  3) Cada mesa toma zona, forma, lugares, número y posición del plano.
      await guardarPlano(plano);
      await sincronizarMesasConPlano(
        plano.mesas.map((m, i) => {
          const original = editor.plano.mesas[i]?.mesaId ?? m.mesaId;
          const existente = mesas.find((x) => x.id === m.mesaId);
          const numero = editor.numeros[original];
          return { mesaId: m.mesaId, numero: existente && existente.numero !== numero ? numero : undefined, zona: zonaDeMesa(plano, m)?.nombre ?? null, forma: m.forma, capacidad: m.asientos, x: m.x, y: m.y };
        }),
      );
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['plano'] }), queryClient.invalidateQueries({ queryKey: ['mesas'] })]);
      editor.setSucio(false);
      haptic.exito();
      setAviso('Plano guardado');
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'No se pudo guardar el plano');
    } finally {
      setGuardando(false);
    }
  };

  const cerrar = () => {
    if (editor.sucio) { setConfirmarSalida(true); return; }
    if (router.canGoBack()) router.back(); else router.replace('/salon');
  };

  const etiquetaSeleccion = (() => {
    const s = editor.seleccion;
    if (!s) return null;
    if (s.tipo === 'mesa') return `Mesa ${editor.numeros[s.id] ?? ''}`;
    if (s.tipo === 'zona') return editor.plano.zonas.find((z) => z.id === s.id)?.nombre ?? 'Zona';
    return 'Objeto';
  })();

  const inspectorProps = { editor, mesas, onSubirFondo: subirFondo, subiendoFondo, onAnalizar: () => setAnalizarAbierto(true) };

  return (
    <View style={[styles.raiz, { backgroundColor: colors.bg }]}>
      <View style={styles.fila}>
        <View style={styles.lienzo}>
          <PlanoCanvas
            ref={lienzo}
            plano={editor.plano}
            info={info}
            modo="edicion"
            seleccion={editor.seleccion}
            onSeleccionar={editor.setSeleccion}
            onMover={editor.mover}
            onRedimensionar={editor.redimensionar}
          />

          {/* Barra superior flotante */}
          <View style={[styles.barra, { top: insets.top + space.md }]} pointerEvents="box-none">
            <View style={[styles.pastilla, { borderColor: colors.separator }]}>
              <BlurView intensity={70} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
              <PressableScale onPress={cerrar} accessibilityLabel="Cerrar editor" style={styles.icono}><X size={22} color={colors.label} /></PressableScale>
              <View style={styles.titulo}>
                <Text variant="headline" numberOfLines={1}>Plano del salón</Text>
                <Text variant="caption" color="secondary">{editor.sucio ? 'Cambios sin guardar' : 'Todo guardado'}</Text>
              </View>
              <PressableScale onPress={editor.deshacer} disabled={!editor.puedeDeshacer} accessibilityLabel="Deshacer" style={[styles.icono, !editor.puedeDeshacer && { opacity: 0.35 }]}><Undo2 size={21} color={colors.label} /></PressableScale>
              <Button label="Guardar" size="sm" loading={guardando} disabled={!editor.sucio} onPress={guardar} />
            </View>
          </View>

          {error ? <View style={[styles.error, { top: insets.top + 84 }]}><ErrorBanner message={error} action={<Button label="Cerrar" size="sm" variant="plain" onPress={() => setError(null)} />} /></View> : null}

          {/* Barra inferior: agregar y, en celular, editar lo elegido */}
          <View style={[styles.abajo, { bottom: insets.bottom + space.lg }]} pointerEvents="box-none">
            {!ancho && etiquetaSeleccion ? (
              <Button label={`Editar ${etiquetaSeleccion}`} variant="tinted" icon={<SlidersHorizontal size={18} color={colors.tint} />} onPress={() => setInspectorAbierto(true)} style={styles.sombra} />
            ) : null}
            {!ancho && !etiquetaSeleccion ? (
              <Button label="El local" variant="tinted" icon={<SlidersHorizontal size={18} color={colors.tint} />} onPress={() => setInspectorAbierto(true)} style={styles.sombra} />
            ) : null}
            <Button label="Agregar" icon={<Plus size={20} color={colors.onTint} />} onPress={() => setAgregarAbierto(true)} style={styles.sombra} />
          </View>
        </View>

        {ancho ? (
          <View style={[styles.panel, { backgroundColor: colors.bg, borderLeftColor: colors.separator, paddingTop: insets.top + space.md }]}>
            <Text variant="title3" style={{ paddingHorizontal: space.xl, paddingTop: space.md }}>{etiquetaSeleccion ?? 'El local'}</Text>
            <InspectorScroll {...inspectorProps} />
          </View>
        ) : null}
      </View>

      {!ancho ? (
        <Sheet open={inspectorAbierto} onClose={() => setInspectorAbierto(false)} title={etiquetaSeleccion ?? 'El local'}>
          <InspectorScroll {...inspectorProps} />
        </Sheet>
      ) : null}

      <AgregarSheet
        open={agregarAbierto}
        onClose={() => setAgregarAbierto(false)}
        sinUbicar={sinUbicar}
        onMesa={(forma, existente) => { editor.agregarMesa(forma, centro(), existente); setAgregarAbierto(false); }}
        onZona={() => { editor.agregarZona(centro()); setAgregarAbierto(false); }}
        onElemento={(tipo) => { editor.agregarElemento(tipo, centro()); setAgregarAbierto(false); }}
      />

      <AnalizarPlanoSheet
        open={analizarAbierto}
        onClose={() => setAnalizarAbierto(false)}
        plano={editor.plano}
        mesas={mesas}
        onAplicar={(nuevo, numerosNuevos) => {
          editor.reemplazar(nuevo);
          Object.entries(numerosNuevos).forEach(([id, n]) => editor.fijarNumero(id, n));
          setAnalizarAbierto(false);
          setAviso('Plano armado: revisalo y guardá');
          lienzo.current?.encuadrar();
        }}
      />

      <Sheet
        open={confirmarSalida}
        onClose={() => setConfirmarSalida(false)}
        title="¿Salir sin guardar?"
        footer={
          <View style={{ gap: space.sm }}>
            <Button label="Guardar y salir" size="lg" full loading={guardando} onPress={async () => { await guardar(); setConfirmarSalida(false); if (router.canGoBack()) router.back(); else router.replace('/salon'); }} />
            <Button label="Descartar cambios" size="lg" variant="destructive" full onPress={() => { setConfirmarSalida(false); if (router.canGoBack()) router.back(); else router.replace('/salon'); }} />
          </View>
        }
      >
        <Text variant="callout" color="secondary" style={{ paddingBottom: space.sm }}>Hiciste cambios en el plano que todavía no se guardaron.</Text>
      </Sheet>

      <Toast message={aviso} onHide={() => setAviso(null)} offset={76} />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fila: { flex: 1, flexDirection: 'row' },
  lienzo: { flex: 1 },
  panel: { width: 360, borderLeftWidth: StyleSheet.hairlineWidth },
  barra: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  pastilla: { width: '100%', maxWidth: 640, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, paddingRight: space.md, borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 6px 24px rgba(0,0,0,0.12)' },
  titulo: { flex: 1 },
  icono: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { position: 'absolute', left: space.lg, right: space.lg },
  abajo: { position: 'absolute', left: space.lg, right: 84, flexDirection: 'row', justifyContent: 'center', gap: space.sm, flexWrap: 'wrap' },
  sombra: { boxShadow: '0 6px 20px rgba(0,0,0,0.16)' },
});
