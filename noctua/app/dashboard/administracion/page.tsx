'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Shield, Building2 } from 'lucide-react';
import { ConfirmarEliminarUsuario } from '@/components/administracion/ConfirmarEliminarUsuario';
import { UsuarioModal } from '@/components/administracion/UsuarioModal';
import { UsuariosTable } from '@/components/administracion/UsuariosTable';
import { obtenerMensajeError } from '@/components/administracion/usuariosHelpers';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { eliminarUsuario, obtenerUsuarios } from '@/services/usuariosService';
import { eliminarAuthUsuario } from '@/services/authService';
import type { Usuario } from '@/types/usuario';

export default function AdministracionPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'equipo' | 'negocio'>(searchParams.get('tab') === 'negocio' ? 'negocio' : 'equipo');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalFormAbierto, setModalFormAbierto] = useState(false);
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerUsuarios();
      setUsuarios(data);
    } catch {
      toast.error('No se pudieron cargar los usuarios.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [cargar]);

  const abrirCrear = useCallback(() => {
    setUsuarioSeleccionado(null);
    setModalFormAbierto(true);
  }, []);

  const cerrarFormulario = useCallback(() => {
    setModalFormAbierto(false);
  }, []);

  const abrirEditar = useCallback((usuario: Usuario) => {
    setUsuarioSeleccionado(usuario);
    setModalFormAbierto(true);
  }, []);

  const abrirEliminar = useCallback((usuario: Usuario) => {
    setUsuarioSeleccionado(usuario);
    setModalEliminarAbierto(true);
  }, []);

  const cerrarEliminar = useCallback(() => {
    setModalEliminarAbierto(false);
  }, []);

  const confirmarEliminar = useCallback(async () => {
    if (!usuarioSeleccionado) return;

    setEliminando(true);
    try {
      await eliminarAuthUsuario(usuarioSeleccionado.auth_user_id);
      await eliminarUsuario(usuarioSeleccionado.id);
      toast.success('Usuario eliminado');
      await cargar();
      setModalEliminarAbierto(false);
    } catch (err) {
      toast.error(obtenerMensajeError(err, 'No se pudo eliminar el usuario.'));
    } finally {
      setEliminando(false);
    }
  }, [cargar, usuarioSeleccionado]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-[#676B67]" />
          <div>
            <h1 className="text-white font-bold text-xl">Administración</h1>
            <p className="text-[#676B67] text-xs mt-0.5">
              {tab === 'equipo' ? `Gestión de usuarios - ${usuarios.length} usuarios registrados` : 'Datos generales del negocio'}
            </p>
          </div>
        </div>
        {tab === 'equipo' && (
          <Button onClick={abrirCrear} className="flex items-center gap-2">
            <Plus size={15} />
            Nuevo usuario
          </Button>
        )}
      </div>

      <div className="flex rounded-xl bg-[#0d110e] p-1 w-fit">
        <button onClick={() => setTab('equipo')} className={`flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${tab === 'equipo' ? 'bg-[#7ed957] text-[#0e0e0e]' : 'text-[#829487] hover:text-white'}`}>
          <Shield size={15} />Equipo
        </button>
        <button onClick={() => setTab('negocio')} className={`flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${tab === 'negocio' ? 'bg-[#7ed957] text-[#0e0e0e]' : 'text-[#829487] hover:text-white'}`}>
          <Building2 size={15} />Negocio
        </button>
      </div>

      {tab === 'equipo' ? (
        <UsuariosTable
          usuarios={usuarios}
          cargando={cargando}
          onCrear={abrirCrear}
          onEditar={abrirEditar}
          onEliminar={abrirEliminar}
        />
      ) : (
        <NegocioTab />
      )}

      <UsuarioModal
        isOpen={modalFormAbierto}
        onClose={cerrarFormulario}
        usuarioEditar={usuarioSeleccionado}
        onSuccess={cargar}
      />

      <ConfirmarEliminarUsuario
        isOpen={modalEliminarAbierto}
        usuario={usuarioSeleccionado}
        onClose={cerrarEliminar}
        onConfirm={confirmarEliminar}
        eliminando={eliminando}
      />
    </div>
  );
}

// Migrado de superadm/configuracion: formulario de datos del negocio, aún sin backend real
// (no había persistencia detrás ni en su ubicación anterior). Se deja explícitamente marcado
// como vista previa en vez de simular un guardado que no ocurre.
function NegocioTab() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="bg-[#101010] border border-[#252525] rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Información del negocio</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[#676b67] text-sm mb-2">Nombre del negocio</label>
            <input type="text" defaultValue="Vase Rest" className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-[#676b67] text-sm mb-2">Dirección</label>
            <input type="text" defaultValue="Calle Principal 123" className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-[#676b67] text-sm mb-2">Teléfono</label>
            <input type="text" defaultValue="+54 9 11 1234-5678" className="w-full bg-[#0d0d0d] border border-[#252525] rounded-lg px-4 py-2 text-white" />
          </div>
        </div>
      </div>

      <div className="bg-[#101010] border border-amber-500/20 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-2">Vista previa</h2>
        <p className="text-sm text-amber-300/80">
          Esta sección todavía no está conectada a datos reales — los cambios que hagas acá no se guardan.
        </p>
      </div>

      <div className="lg:col-span-2">
        <Button disabled className="opacity-50 cursor-not-allowed">
          Guardar (aún no disponible)
        </Button>
      </div>
    </div>
  );
}
