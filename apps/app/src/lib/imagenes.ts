import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { subirImagen } from '@vase/api';

/**
 * Abre la galería (o el selector de archivos en web/escritorio), achica la foto a un ancho
 * razonable, la comprime en JPEG y la sube. Devuelve la ruta en el servidor o null si se canceló.
 */
export async function elegirYSubirImagen({ anchoMax = 1600, calidad = 0.82 } = {}): Promise<string | null> {
  const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
  if (resultado.canceled || !resultado.assets?.[0]) return null;
  const foto = resultado.assets[0];
  const contexto = ImageManipulator.manipulate(foto.uri);
  if ((foto.width ?? 0) > anchoMax) contexto.resize({ width: anchoMax });
  const imagen = await contexto.renderAsync();
  const salida = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: calidad, base64: true });
  if (!salida.base64) throw new Error('No se pudo leer la imagen');
  return subirImagen(salida.base64);
}
