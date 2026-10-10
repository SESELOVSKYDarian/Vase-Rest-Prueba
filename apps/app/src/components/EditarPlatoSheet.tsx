import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react-native';
import { actualizarProducto, archivarProducto, crearProducto, guardarEtiquetas, type CategoriaMenu, type Etiqueta, type ProductoMenu } from '@vase/api';
import { parsearPesos } from '@vase/domain';
import { Button, Chip, ErrorBanner, Field, Group, PressableScale, Row, Sheet, Text, haptic, radius, space, useTheme } from '@vase/ui';
import { FotoPlato } from '@/components/FotoPlato';
import { elegirYSubirImagen } from '@/lib/imagenes';

interface Props {
  /** Plato a editar; `'nuevo'` para cargar uno; null cerrado. */
  plato: ProductoMenu | 'nuevo' | null;
  categorias: CategoriaMenu[];
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

const formatoPrecio = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** 1590000 → "15.900"; 1250050 → "12.500,5" (lo mismo que se escribe a mano). */
const ETIQUETAS_EDITABLES: Array<[Etiqueta, string]> = [['sin_tacc', 'Sin TACC'], ['vegano', 'Vegano'], ['vegetariano', 'Vegetariano'], ['sin_lactosa', 'Sin lactosa'], ['picante', 'Picante']];

const precioATexto = (centavos: number) => formatoPrecio.format(centavos / 100);

export function EditarPlatoSheet({ plato, categorias, onClose, onGuardado }: Props) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const nuevo = plato === 'nuevo';
  const base = plato && plato !== 'nuevo' ? plato : null;

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [foto, setFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre, el formulario arranca con los datos del plato elegido.
  useEffect(() => {
    if (!plato) return;
    setNombre(base?.nombre ?? '');
    setDescripcion(base?.descripcion ?? '');
    setPrecio(base ? precioATexto(base.precio) : '');
    setCategoriaId(base?.categoriaId ?? categorias[0]?.id ?? null);
    setDisponible(base?.disponible ?? true);
    setEtiquetas(base?.etiquetas ?? []);
    setFoto(base?.imagenUrl ?? null);
    setConfirmarQuitar(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plato]);

  const cambiarFoto = async () => {
    setError(null);
    try {
      setSubiendo(true);
      const ruta = await elegirYSubirImagen({ anchoMax: 1400, calidad: 0.8 });
      if (ruta) { setFoto(ruta); haptic.ligero(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  const centavos = parsearPesos(precio);
  const valido = nombre.trim().length > 1 && centavos !== null && centavos > 0;

  const terminar = async (mensaje: string) => {
    await queryClient.invalidateQueries({ queryKey: ['menu'] });
    haptic.exito();
    onGuardado(mensaje);
  };

  const guardar = async () => {
    if (!valido || centavos === null) {
      setError(nombre.trim().length <= 1 ? 'Poné el nombre del plato.' : 'Revisá el precio: por ejemplo 12.500 o 12500,50.');
      haptic.error();
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const datos = { nombre, descripcion, precio: centavos, categoriaId, imagenUrl: foto };
      if (base) {
        await actualizarProducto(base.id, { ...datos, disponible });
        await guardarEtiquetas(base.id, etiquetas);
      } else {
        const id = await crearProducto(datos);
        if (id && etiquetas.length) await guardarEtiquetas(id, etiquetas);
      }
      await terminar(base ? 'Plato actualizado' : 'Plato agregado a la carta');
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    if (!base) return;
    setGuardando(true);
    try {
      await archivarProducto(base.id);
      await terminar('Plato quitado de la carta');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Sheet
      open={!!plato}
      onClose={onClose}
      title={nuevo ? 'Nuevo plato' : 'Editar plato'}
      footer={<Button label={nuevo ? 'Agregar a la carta' : 'Guardar'} size="lg" full loading={guardando} disabled={subiendo} onPress={guardar} />}
    >
      <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <PressableScale onPress={cambiarFoto} disabled={subiendo} scaleTo={0.985} accessibilityLabel={foto ? 'Cambiar foto' : 'Agregar foto'} style={styles.fotoBoton}>
          <FotoPlato ruta={foto} ancho={480} alto={260} radio={radius.lg} style={styles.foto} />
          <View style={[styles.fotoAccion, { backgroundColor: colors.surface2 }]}>
            <Camera size={18} color={colors.tint} />
            <Text variant="subhead" weight="600" color="tint">{subiendo ? 'Subiendo…' : foto ? 'Cambiar foto' : 'Agregar foto'}</Text>
          </View>
        </PressableScale>
        {foto ? <Button label="Quitar foto" variant="plain" size="sm" onPress={() => setFoto(null)} /> : null}

        {error ? <ErrorBanner message={error} /> : null}

        <Group>
          <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Milanesa napolitana" autoCapitalize="sentences" returnKeyType="next" />
          <Field label="Precio" value={precio} onChangeText={setPrecio} placeholder="12.500" keyboardType="decimal-pad" inputMode="decimal" />
          <Field label="Descripción" value={descripcion} onChangeText={setDescripcion} placeholder="Con papas fritas" multiline />
        </Group>

        {categorias.length ? (
          <View style={styles.bloque}>
            <Text variant="footnote" color="secondary" style={styles.rotulo}>Categoría</Text>
            <View style={styles.chips}>
              {categorias.map((c) => <Chip key={c.id} label={c.nombre} selected={categoriaId === c.id} onPress={() => setCategoriaId(c.id)} />)}
            </View>
          </View>
        ) : null}

        <View style={styles.bloque}>
          <Text variant="footnote" color="secondary" style={styles.rotulo}>Etiquetas (se muestran al cliente y sirven para filtrar)</Text>
          <View style={styles.chips}>
            {ETIQUETAS_EDITABLES.map(([e, n]) => <Chip key={e} label={n} selected={etiquetas.includes(e)} onPress={() => setEtiquetas(etiquetas.includes(e) ? etiquetas.filter((x) => x !== e) : [...etiquetas, e])} />)}
          </View>
        </View>

        {base ? (
          <Group footer="Un plato agotado sigue en la carta pero no se puede pedir, ni desde el salón ni desde el QR.">
            <Row
              title="Disponible"
              trailing={<Switch value={disponible} onValueChange={(v) => { haptic.seleccion(); setDisponible(v); }} trackColor={{ true: colors.tint, false: colors.fill }} accessibilityLabel="Disponible" />}
            />
          </Group>
        ) : null}

        {base ? (
          confirmarQuitar ? (
            <View style={styles.bloque}>
              <Text variant="footnote" color="secondary" align="center">Deja de aparecer en la carta y en el QR. Los pedidos y facturas anteriores no cambian.</Text>
              <Button label="Sí, quitar de la carta" variant="destructive" full onPress={quitar} />
              <Button label="Cancelar" variant="plain" full onPress={() => setConfirmarQuitar(false)} />
            </View>
          ) : (
            <Group>
              <Row title="Quitar de la carta" destructive leading={<Trash2 size={20} color={colors.danger} />} onPress={() => { haptic.medio(); setConfirmarQuitar(true); }} />
            </Group>
          )
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.lg, paddingBottom: space.md },
  fotoBoton: { borderRadius: radius.lg },
  foto: { width: '100%' },
  fotoAccion: { position: 'absolute', right: space.md, bottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, boxShadow: '0 4px 14px rgba(0,0,0,0.16)' },
  bloque: { gap: space.sm },
  rotulo: { paddingHorizontal: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
