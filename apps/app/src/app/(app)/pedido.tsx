import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mic, NotebookPen, Plus } from 'lucide-react-native';
import { abrirPedido, agregarProducto, type ProductoMenu } from '@vase/api';
import { formatearARS } from '@vase/domain';
import { Button, Chip, EmptyState, ErrorBanner, Group, PressableScale, Row, Screen, Skeleton, Stepper, Text, Toast, haptic, minTarget, space, useTheme } from '@vase/ui';
import { CartBar } from '@/components/CartBar';
import { DictadoPedido } from '@/components/DictadoPedido';
import { useCart } from '@/lib/cart';
import { FotoPlato } from '@/components/FotoPlato';
import { useCategorias, useMesas, usePedidosActivos, useProductos } from '@/lib/queries';

export default function Pedido() {
  const { mesaId } = useLocalSearchParams<{ mesaId?: string }>();
  const router = useRouter();
  const { colors, sizeClass } = useTheme();
  const queryClient = useQueryClient();
  const mesasQ = useMesas();
  const pedidosQ = usePedidosActivos();
  const categoriasQ = useCategorias();
  const productosQ = useProductos();
  const cart = useCart();
  const [categoria, setCategoria] = useState<string>('todas');
  const [comensales, setComensales] = useState(2);
  const [aviso, setAviso] = useState<string | null>(null);

  const mesa = mesasQ.data?.find((m) => m.id === mesaId) ?? null;
  const pedido = pedidosQ.data?.find((p) => p.mesaId === mesaId) ?? null;
  const productos = productosQ.data ?? [];
  const lineasCarrito = cart.mesaId === mesaId ? cart.lineas : [];
  // El stepper de cada plato mueve la línea sin aclaraciones; las dictadas con aclaraciones se ven en "Para enviar".
  const cantidades = Object.fromEntries(lineasCarrito.filter((l) => !l.notas).map((l) => [l.productoId, l.cantidad]));
  const [dictando, setDictando] = useState(false);

  const visibles = useMemo(
    () => productos.filter((p) => (categoria === 'todas' ? true : p.categoriaId === categoria)),
    [productos, categoria],
  );
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const unidades = lineasCarrito.reduce((suma, l) => suma + l.cantidad, 0);
  const total = lineasCarrito.reduce((suma, l) => suma + (porId.get(l.productoId)?.precio ?? 0) * l.cantidad, 0);

  const fijar = (producto: ProductoMenu, cantidad: number) => {
    if (!mesaId) return;
    cart.iniciar(mesaId);
    cart.fijar(producto.id, cantidad);
    setAviso(null);
  };

  const enviar = useMutation({
    mutationFn: async () => {
      if (!mesaId) throw new Error('Elegí una mesa primero');
      const abierto = await abrirPedido(mesaId, pedido ? undefined : comensales);
      const enviados: string[] = [];
      try {
        for (const l of lineasCarrito) {
          await agregarProducto(abierto.id, l.productoId, l.cantidad, l.notas || undefined);
          enviados.push(l.clave);
        }
      } catch (error) {
        // Lo que ya llegó a cocina sale del carrito; lo que falló queda para reintentar.
        enviados.forEach((clave) => cart.quitar(clave));
        throw error;
      }
    },
    onSuccess: () => {
      cart.vaciar();
      haptic.exito();
      setAviso('Enviado a cocina');
      void queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      void queryClient.invalidateQueries({ queryKey: ['mesas'] });
    },
    onError: () => haptic.error(),
  });

  // Sin mesa elegida: se elige acá mismo, sin volver al salón.
  if (!mesaId || (mesasQ.isSuccess && !mesa)) {
    return (
      <Screen title="Pedido" subtitle="Elegí la mesa" bottomInset={sizeClass === 'compact' ? 72 : 0}>
        {mesasQ.isPending ? <Skeleton height={240} rounded={18} /> : (mesasQ.data?.length ?? 0) === 0 ? (
          <EmptyState icon={<NotebookPen size={30} color={colors.labelSecondary} />} title="No hay mesas" message="Cargá las mesas del local para tomar pedidos." />
        ) : (
          <Group>
            {mesasQ.data!.map((m) => (
              <Row key={m.id} title={`Mesa ${m.numero}`} subtitle={`${m.zona} · ${m.capacidad} lugares`} chevron onPress={() => router.setParams({ mesaId: m.id })} />
            ))}
          </Group>
        )}
      </Screen>
    );
  }

  const cargando = productosQ.isPending || categoriasQ.isPending;

  return (
    <>
      <Screen
        title={mesa ? `Mesa ${mesa.numero}` : 'Pedido'}
        subtitle={pedido ? `${pedido.items.length} ${pedido.items.length === 1 ? 'ítem pedido' : 'ítems pedidos'} · ${formatearARS(pedido.total, true)}` : 'Pedido nuevo'}
        headerRight={
          <View style={styles.acciones}>
            <Button label="Dictar" size="sm" icon={<Mic size={16} color={colors.onTint} />} onPress={() => { cart.iniciar(mesaId); setDictando(true); }} />
            <Button label="Cambiar mesa" size="sm" variant="tinted" onPress={() => router.setParams({ mesaId: '' })} />
          </View>
        }
        bottomInset={unidades > 0 ? 120 : sizeClass === 'compact' ? 72 : 0}
      >
        {enviar.isError ? <ErrorBanner message={enviar.error instanceof Error ? enviar.error.message : 'No se pudo enviar el pedido'} /> : null}

        {!pedido ? (
          <Group header="Comensales">
            <Row title="En la mesa" trailing={<Stepper value={comensales} min={1} max={Math.max(12, mesa?.capacidad ?? 12)} onChange={setComensales} label="comensales" />} />
          </Group>
        ) : null}

        {lineasCarrito.length > 0 ? (
          <Group header="Para enviar">
            {lineasCarrito.map((l) => (
              <Row
                key={l.clave}
                title={porId.get(l.productoId)?.nombre ?? 'Plato'}
                subtitle={l.notas || undefined}
                trailing={<Stepper value={l.cantidad} min={0} max={30} onChange={(n) => cart.cambiarCantidad(l.clave, n)} label={porId.get(l.productoId)?.nombre ?? 'Plato'} />}
              />
            ))}
          </Group>
        ) : null}

        {pedido && pedido.items.length > 0 ? (
          <Group header="Ya pedido">
            {pedido.items.map((item) => (
              <Row key={item.id} title={`${item.cantidad} × ${item.nombre}`} subtitle={item.notas || undefined} value={formatearARS(item.subtotal, true)} />
            ))}
          </Group>
        ) : null}

        <View style={styles.menu}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Todo" selected={categoria === 'todas'} onPress={() => setCategoria('todas')} />
            {(categoriasQ.data ?? []).map((c) => <Chip key={c.id} label={c.nombre} selected={categoria === c.id} onPress={() => setCategoria(c.id)} />)}
          </ScrollView>

          {cargando ? (
            <View style={{ gap: space.md }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={56} rounded={14} />)}</View>
          ) : productosQ.isError ? (
            <ErrorBanner message="No se pudo cargar la carta" action={<Button label="Reintentar" size="sm" variant="tinted" onPress={() => void productosQ.refetch()} />} />
          ) : visibles.length === 0 ? (
            <EmptyState icon={<NotebookPen size={30} color={colors.labelSecondary} />} title="Nada en esta categoría" message="Elegí otra categoría o cargá platos desde Menú." />
          ) : (
            <Group>
              {visibles.map((p) => {
                const q = cantidades[p.id] ?? 0;
                return (
                  <Row
                    key={p.id}
                    title={p.nombre}
                    leading={<FotoPlato ruta={p.imagenUrl} ancho={52} radio={10} />}
                    detail={
                      <Text variant="footnote" color="secondary" numberOfLines={2}>
                        <Text variant="footnote" weight="600" numeric>{formatearARS(p.precio, true)}</Text>
                        {p.disponible ? (p.descripcion ? `  ·  ${p.descripcion}` : '') : '  ·  Agotado'}
                      </Text>
                    }
                    trailing={
                      !p.disponible ? null : q === 0 ? (
                        <PressableScale onPress={() => { haptic.ligero(); fijar(p, 1); }} accessibilityLabel={`Agregar ${p.nombre}`} style={[styles.add, { backgroundColor: colors.tintSoft }]}>
                          <Plus size={20} color={colors.tint} strokeWidth={2.6} />
                        </PressableScale>
                      ) : (
                        <Stepper value={q} min={0} onChange={(n) => fijar(p, n)} label={p.nombre} />
                      )
                    }
                  />
                );
              })}
            </Group>
          )}
        </View>
      </Screen>
      <DictadoPedido open={dictando} onClose={() => setDictando(false)} onAgregar={(nuevas) => { cart.agregar(nuevas); setAviso(`${nuevas.reduce((s2, n) => s2 + n.cantidad, 0)} agregados: revisalos y enviá`); }} />
      <Toast message={aviso} onHide={() => setAviso(null)} />
      {unidades > 0 ? <CartBar unidades={unidades} total={total} enviando={enviar.isPending} onEnviar={() => enviar.mutate()} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  acciones: { flexDirection: 'row', gap: space.sm },
  menu: { gap: space.lg },
  chips: { gap: space.sm, paddingRight: space.xl },
  add: { width: minTarget - 4, height: minTarget - 4, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
