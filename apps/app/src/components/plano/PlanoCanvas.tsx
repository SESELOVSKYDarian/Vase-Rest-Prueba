import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Maximize2, Minus, Plus } from 'lucide-react-native';
import { ESTADOS_CON_PERSONAS, type EstadoMesa, type MesaEnPlano, type NivelAlerta, type Plano } from '@vase/domain';
import { urlArchivo } from '@vase/api';
import { PressableScale, materialPlano, radius, space, useEstadoColor, useTheme, zonaColor } from '@vase/ui';
import { ElementoSvg, MesaSvg, ZonaSvg, ladoElemento, ladoMesa } from './dibujos';
import { ManijaTamano } from './ManijaTamano';
import { CalorBajoMesa, InsigniaMozo, PulsoMesa } from './MarcasMesa';
import { NodoPlano } from './NodoPlano';
import { PisoPlano } from './PisoPlano';

export type Seleccion = { tipo: 'mesa' | 'zona' | 'elemento'; id: string } | null;

export interface InfoMesa {
  numero: number;
  estado: EstadoMesa;
  detalle?: string;
}

export interface PlanoCanvasHandle {
  /** Centro de la vista actual en cm del plano (para agregar objetos donde se está mirando). */
  centroVisible: () => { x: number; y: number };
  encuadrar: () => void;
}

interface Props {
  plano: Plano;
  info: (mesaId: string) => InfoMesa | null;
  modo: 'servicio' | 'edicion';
  seleccion?: Seleccion;
  onSeleccionar?: (seleccion: Seleccion) => void;
  onMover?: (tipo: 'mesa' | 'zona' | 'elemento', id: string, dx: number, dy: number) => void;
  /** Estirar una zona u objeto desde su esquina (edición). */
  onRedimensionar?: (tipo: 'zona' | 'elemento', id: string, dw: number, dh: number) => void;
  /** Mesas atenuadas por un filtro (servicio). */
  visibles?: ReadonlySet<string> | null;
  /** Mesa demorada: late en el plano (servicio). */
  alerta?: (mesaId: string) => Exclude<NivelAlerta, 'ok'> | null;
  /** Mapa de calor: intensidad 0..1 y valor a mostrar bajo cada mesa. */
  calor?: ((mesaId: string) => { intensidad: number; etiqueta: string } | null) | null;
  colorCalor?: string;
  /** Iniciales del mozo que atiende cada mesa. */
  insignia?: (mesaId: string) => string | null;
  /** Contenido extra sobre el lienzo, fijo a la pantalla (barras, controles). */
  superposicion?: ReactNode;
}

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const MIN = 0.12;
const MAX = 3;

/**
 * Lienzo del plano: piso con grilla de 50 cm, foto del local opcional, zonas, elementos y mesas.
 * Pellizcar para zoom, arrastrar el fondo para moverse; en edición, arrastrar objetos.
 */
export const PlanoCanvas = forwardRef<PlanoCanvasHandle, Props>(function PlanoCanvas(
  { plano, info, modo, seleccion, onSeleccionar, onMover, onRedimensionar, visibles, alerta, calor, colorCalor, insignia, superposicion },
  ref,
) {
  const { colors, dark } = useTheme();
  const material = materialPlano(plano.estilo, dark);
  const colorEstado = useEstadoColor();
  const [vista, setVista] = useState({ w: 0, h: 0 });

  const escala = useSharedValue(0.5);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const inicio = useSharedValue({ s: 1, x: 0, y: 0 });
  // Mientras nadie movió el plano a mano, se vuelve a encuadrar si cambia el tamaño de la vista o del local.
  const movido = useSharedValue(false);

  const ajusteInicial = useCallback(
    (w: number, h: number, animado: boolean) => {
      if (!w || !h) return;
      const s = Math.max(MIN, Math.min(MAX, Math.min(w / plano.ancho, h / plano.alto) * 0.94));
      const x = (w - plano.ancho * s) / 2;
      const y = (h - plano.alto * s) / 2;
      const t = (v: number) => (animado ? withTiming(v, { duration: 280, easing: EASE }) : v);
      escala.set(t(s));
      tx.set(t(x));
      ty.set(t(y));
    },
    [plano.ancho, plano.alto, escala, tx, ty],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const primera = vista.w === 0;
    setVista({ w: width, h: height });
    if (primera || !movido.get()) ajusteInicial(width, height, !primera);
  };

  useEffect(() => {
    if (!movido.get()) ajusteInicial(vista.w, vista.h, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano.ancho, plano.alto]);

  const zoom = (factor: number) => {
    movido.set(true);
    const s0 = escala.get();
    const s = Math.max(MIN, Math.min(MAX, s0 * factor));
    // Zoom alrededor del centro de la vista.
    const cx = vista.w / 2;
    const cy = vista.h / 2;
    tx.set(withTiming(cx - (cx - tx.get()) * (s / s0), { duration: 220, easing: EASE }));
    ty.set(withTiming(cy - (cy - ty.get()) * (s / s0), { duration: 220, easing: EASE }));
    escala.set(withTiming(s, { duration: 220, easing: EASE }));
  };

  useImperativeHandle(ref, () => ({
    centroVisible: () => ({ x: (vista.w / 2 - tx.get()) / escala.get(), y: (vista.h / 2 - ty.get()) / escala.get() }),
    encuadrar: () => { movido.set(false); ajusteInicial(vista.w, vista.h, true); },
  }), [vista, tx, ty, escala, ajusteInicial]);

  const pellizco = Gesture.Pinch()
    .onStart(() => { movido.set(true); inicio.set({ s: escala.get(), x: tx.get(), y: ty.get() }); })
    .onUpdate((e) => {
      const i = inicio.get();
      const s = Math.max(MIN, Math.min(MAX, i.s * e.scale));
      escala.set(s);
      tx.set(e.focalX - (e.focalX - i.x) * (s / i.s));
      ty.set(e.focalY - (e.focalY - i.y) * (s / i.s));
    });
  const arrastre = Gesture.Pan()
    .minDistance(2)
    .onStart(() => { movido.set(true); inicio.set({ s: escala.get(), x: tx.get(), y: ty.get() }); })
    .onUpdate((e) => {
      const i = inicio.get();
      tx.set(i.x + e.translationX);
      ty.set(i.y + e.translationY);
    });
  const gestoLienzo = Gesture.Simultaneous(pellizco, arrastre);

  // La escala se aplica alrededor del centro (origen por defecto en todas las plataformas):
  // se compensa en la traslación para que el resultado sea pantalla = t + s·p desde la esquina.
  const ancho = plano.ancho;
  const alto = plano.alto;
  const lienzo = useAnimatedStyle(() => {
    const s = escala.get();
    return {
      transform: [
        { translateX: tx.get() - (ancho / 2) * (1 - s) },
        { translateY: ty.get() - (alto / 2) * (1 - s) },
        { scale: s },
      ],
    };
  });

  const editar = modo === 'edicion';
  const fondoUrl = urlArchivo(plano.fondo?.url);
  const mesasOrdenadas = useMemo(() => plano.mesas, [plano.mesas]);

  return (
    <View style={[styles.vista, { backgroundColor: material.fondo }]} onLayout={onLayout}>
      <GestureDetector gesture={gestoLienzo}>
        <View style={StyleSheet.absoluteFill}>
          {/* Tocar fuera del local también quita la selección. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onSeleccionar?.(null)} accessible={false} />
          <Animated.View style={[{ width: plano.ancho, height: plano.alto }, lienzo]}>
            <PisoPlano plano={plano} material={material} fondoUrl={fondoUrl} />
            {/* Tocar el piso vacío quita la selección. */}
            <Pressable style={StyleSheet.absoluteFill} onPress={() => onSeleccionar?.(null)} accessible={false} />

            {plano.zonas.map((z) => (
              <NodoPlano
                key={z.id}
                left={z.x}
                top={z.y}
                width={z.w}
                height={z.h}
                escala={escala}
                arrastrable={editar}
                lienzo={editar ? arrastre : undefined}
                onTocar={editar ? () => onSeleccionar?.({ tipo: 'zona', id: z.id }) : undefined}
                onSoltar={(dx, dy) => onMover?.('zona', z.id, dx, dy)}
                accessibilityLabel={`Zona ${z.nombre}`}
              >
                <View pointerEvents={editar ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
                  <ZonaSvg zona={z} material={material} color={zonaColor[z.color][dark ? 'dark' : 'light']} dark={dark} seleccionada={seleccion?.tipo === 'zona' && seleccion.id === z.id} colorSeleccion={colors.tint} />
                </View>
              </NodoPlano>
            ))}

            {plano.elementos.map((e) => {
              const L = ladoElemento(e);
              return (
                <NodoPlano
                  key={e.id}
                  left={e.x - L / 2}
                  top={e.y - L / 2}
                  width={L}
                  height={L}
                  escala={escala}
                  arrastrable={editar}
                  lienzo={editar ? arrastre : undefined}
                  onTocar={editar ? () => onSeleccionar?.({ tipo: 'elemento', id: e.id }) : undefined}
                  onSoltar={(dx, dy) => onMover?.('elemento', e.id, dx, dy)}
                  accessibilityLabel={e.etiqueta || e.tipo}
                >
                  <View pointerEvents={editar ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
                    <ElementoSvg elemento={e} material={material} seleccionado={seleccion?.tipo === 'elemento' && seleccion.id === e.id} colorSeleccion={colors.tint} />
                  </View>
                </NodoPlano>
              );
            })}

            {editar && onRedimensionar && seleccion?.tipo === 'zona' ? (() => {
              const z = plano.zonas.find((x) => x.id === seleccion.id);
              return z ? <ManijaTamano key={z.id} left={z.x} top={z.y} w={z.w} h={z.h} escala={escala} lienzo={arrastre} onFin={(dw, dh) => onRedimensionar('zona', z.id, dw, dh)} /> : null;
            })() : null}
            {editar && onRedimensionar && seleccion?.tipo === 'elemento' ? (() => {
              const e = plano.elementos.find((x) => x.id === seleccion.id);
              // Con el objeto girado 90° la esquina cambia de lado: ahí se usan las medidas del panel.
              return e && e.rot % 180 === 0 ? <ManijaTamano key={e.id} left={e.x - e.w / 2} top={e.y - e.h / 2} w={e.w} h={e.h} escala={escala} lienzo={arrastre} onFin={(dw, dh) => onRedimensionar('elemento', e.id, dw, dh)} /> : null;
            })() : null}

            {mesasOrdenadas.map((m: MesaEnPlano) => {
              const L = ladoMesa(m);
              const datos = info(m.mesaId);
              const color = !editar && datos ? colorEstado(datos.estado) : null;
              const atenuada = !!visibles && !visibles.has(m.mesaId);
              return (
                <NodoPlano
                  key={m.mesaId}
                  left={m.x - L / 2}
                  top={m.y - L / 2}
                  width={L}
                  height={L}
                  escala={escala}
                  arrastrable={editar}
                  lienzo={editar ? arrastre : undefined}
                  onTocar={() => onSeleccionar?.({ tipo: 'mesa', id: m.mesaId })}
                  onSoltar={(dx, dy) => onMover?.('mesa', m.mesaId, dx, dy)}
                  accessibilityLabel={datos ? `Mesa ${datos.numero}, ${m.asientos} lugares` : 'Mesa'}
                >
                  <View style={{ opacity: atenuada ? 0.25 : 1 }}>
                    {!editar && !calor && alerta?.(m.mesaId) ? <PulsoMesa lado={L} diametro={L * 1.15} nivel={alerta(m.mesaId)!} /> : null}
                    {!editar && calor ? (() => { const c = calor(m.mesaId); return c ? <CalorBajoMesa lado={L} intensidad={c.intensidad} etiqueta={c.etiqueta} color={colorCalor ?? colors.tint} /> : null; })() : null}
                    <MesaSvg
                      mesa={m}
                      material={material}
                      numero={datos ? String(datos.numero) : '?'}
                      detalle={datos?.detalle}
                      colorEstado={color}
                      resaltar={!!datos && datos.estado !== 'libre'}
                      ocupada={!!datos && ESTADOS_CON_PERSONAS.has(datos.estado) && !editar}
                      seleccionada={seleccion?.tipo === 'mesa' && seleccion.id === m.mesaId}
                      colorSeleccion={colors.tint}
                    />
                    {!editar && !calor && insignia?.(m.mesaId) ? <InsigniaMozo texto={insignia(m.mesaId)!} lado={L} /> : null}
                  </View>
                </NodoPlano>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.zoom} pointerEvents="box-none">
        <View style={[styles.zoomGrupo, { backgroundColor: colors.surface2, borderColor: colors.separator }]}>
          <PressableScale onPress={() => zoom(1.35)} accessibilityLabel="Acercar" style={styles.zoomBoton}><Plus size={20} color={colors.label} /></PressableScale>
          <View style={[styles.zoomSep, { backgroundColor: colors.separator }]} />
          <PressableScale onPress={() => zoom(1 / 1.35)} accessibilityLabel="Alejar" style={styles.zoomBoton}><Minus size={20} color={colors.label} /></PressableScale>
          <View style={[styles.zoomSep, { backgroundColor: colors.separator }]} />
          <PressableScale onPress={() => { movido.set(false); ajusteInicial(vista.w, vista.h, true); }} accessibilityLabel="Ver todo el plano" style={styles.zoomBoton}><Maximize2 size={18} color={colors.label} /></PressableScale>
        </View>
      </View>
      {superposicion}
    </View>
  );
});

const styles = StyleSheet.create({
  vista: { flex: 1, overflow: 'hidden' },
  zoom: { position: 'absolute', right: space.lg, bottom: space.lg },
  zoomGrupo: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' },
  zoomBoton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomSep: { height: StyleSheet.hairlineWidth },
});
