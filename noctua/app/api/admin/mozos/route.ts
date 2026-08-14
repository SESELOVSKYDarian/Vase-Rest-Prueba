import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/hooks/lib/databaseClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accion } = body;
    console.log('[admin/mozos] Acción:', accion, 'Body:', body);
    const db = database;

    if (accion === 'crear') {
      const { nombre, apellido, zona, posicion_ciclo, activo } = body;

      if (!nombre || !apellido || !zona || posicion_ciclo === undefined) {
        return NextResponse.json({ error: 'Faltan datos obligatorios para crear el mozo.' }, { status: 400 });
      }

      const { data, error } = await db
        .from('mozos')
        .insert({ nombre, apellido, zona, posicion_ciclo, activo })
        .select('*')
        .single();

      if (error) {
        console.error('[admin/mozos] Error al crear mozo:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
        return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
      }

      console.log('[admin/mozos] Mozo creado:', data);
      return NextResponse.json({ mozo: data });
    }

    if (accion === 'actualizar') {
      const { id, nombre, apellido, zona, posicion_ciclo, activo } = body;

      if (!id) {
        return NextResponse.json({ error: 'id es requerido para actualizar.' }, { status: 400 });
      }

      const { error } = await db
        .from('mozos')
        .update({ nombre, apellido, zona, posicion_ciclo, activo })
        .eq('id', id);

      if (error) {
        console.error('[admin/mozos] Error al actualizar mozo:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
        return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
      }

      console.log('[admin/mozos] Mozo actualizado:', id);
      return NextResponse.json({ ok: true });
    }

    if (accion === 'eliminar') {
      const { id } = body;

      if (!id) {
        return NextResponse.json({ error: 'id es requerido para eliminar.' }, { status: 400 });
      }

      console.log('[admin/mozos] Eliminando mozo con id:', id);
      const { error } = await db
        .from('mozos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[admin/mozos] Error al eliminar mozo:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
        return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
      }

      console.log('[admin/mozos] Mozo eliminado:', id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
  } catch (error) {
    console.error('Error en API admin/mozos:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
