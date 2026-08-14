'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, Trash2, X } from 'lucide-react';
import { useSuperAdmStore } from '@/store/superadmStore';
import { useAuthStore } from '@/store/authStore';
import type { DeliveryApp } from '@/types/superadm';
import { DeliveryAppLogo } from '@/components/delivery/DeliveryAppLogo';

type Integracion = 'facturacion' | 'delivery';
const APPS = [
  { id: 'pedidosya', name: 'PedidosYa', env: 'PEDIDOSYA_API_KEY', fields: ['API Key'] },
  { id: 'rappi', name: 'Rappi', env: 'RAPPI_BEARER_TOKEN', fields: ['Bearer Token'] },
  { id: 'ubereats', name: 'Uber Eats', env: 'UBEREATS_API_KEY', fields: ['API Key', 'Store ID'] },
];
const ARCA_FIELDS = ['ARCA_MODO', 'ARCA_CUIT', 'ARCA_PUNTO_VENTA', 'ARCA_CERTIFICATE_PATH', 'ARCA_PRIVATE_KEY_PATH'];

export function ConfiguracionIntegracionModal({ tipo, abierto, onClose, appInicial }: { tipo: Integracion; abierto: boolean; onClose: () => void; appInicial?: DeliveryApp | null }) {
  const { config, addDeliveryApp, updateDeliveryApp, deleteDeliveryApp } = useSuperAdmStore();
  const token = useAuthStore((state) => state.token);
  const [app, setApp] = useState<DeliveryApp | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardado, setGuardado] = useState(false);
  const apps = config.deliveryApps ?? [];
  const spec = APPS.find((item) => item.name === app?.name);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  useEffect(() => {
    if (!abierto) { setApp(null); setValores({}); setGuardado(false); }
    else if (appInicial) setApp(appInicial);
  }, [abierto, appInicial]);
  if (!abierto) return null;

  const seleccionar = (name: string) => {
    const definition = APPS.find((item) => item.name === name)!;
    setApp(apps.find((item) => item.name === name) ?? { id: `da-${Date.now()}`, name, isActive: true, apiKeyEnvVar: definition.env, connectionStatus: 'unconfigured' });
    setGuardado(false);
  };
  const request = (path: string, method: string, body?: unknown) => fetch(`${apiUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const guardarDelivery = async () => {
    if (!app || !spec) return;
    const response = await request(`/integraciones/delivery/${spec.id}`, 'PUT', { pais: valores.pais || 'Argentina', config: valores });
    if (!response.ok) return;
    const data: Partial<DeliveryApp> = { apiKeyEnvVar: spec.env, webhookUrl: valores.webhook, isActive: true, connectionStatus: 'connected' };
    if (apps.some((item) => item.id === app.id)) updateDeliveryApp(app.id, data); else addDeliveryApp({ ...app, ...data });
    setGuardado(true);
  };
  const quitar = async () => {
    if (!app || !spec) return;
    if ((await request(`/integraciones/delivery/${spec.id}`, 'DELETE')).ok) { deleteDeliveryApp(app.id); setApp(null); }
  };
  const guardarArca = async () => {
    if ((await request('/integraciones/facturacion/arca', 'PUT', { config: valores })).ok) setGuardado(true);
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div className="w-full max-w-xl rounded-3xl border border-[#304034] bg-[#151a16] p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold text-white">{tipo === 'delivery' ? 'Agregar app' : 'Configurar ARCA'}</h2><p className="mt-2 text-sm text-[#829487]">{tipo === 'delivery' ? 'Elegí una app para vincular o editar sus credenciales.' : 'Editá las credenciales fiscales desde este formulario.'}</p></div><button onClick={onClose} aria-label="Cerrar" className="p-2 text-[#829487]"><X size={18} /></button></div>
      {tipo === 'delivery' && !app && <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">{APPS.map((item) => <button key={item.id} onClick={() => seleccionar(item.name)} className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-[#304034] px-3 py-4 font-semibold text-[#b7c8bc] hover:border-[#7ed957]"><DeliveryAppLogo name={item.name} />{item.name}</button>)}</div>}
      {tipo === 'delivery' && app && <div><button onClick={() => setApp(null)} className="mt-5 flex items-center gap-1 text-xs text-[#829487]"><ChevronLeft size={15} />Volver</button><div className="mt-4 rounded-2xl border border-[#26362a] bg-[#0e130f] p-4"><div className="flex justify-between gap-3"><div className="flex items-center gap-3"><DeliveryAppLogo name={app.name} /><div><p className="font-semibold text-white">{app.name}</p><code className="text-xs text-[#829487]">{spec?.env}</code></div></div>{apps.some((item) => item.id === app.id) && <button onClick={() => void quitar()} className="flex items-center gap-1 text-xs text-red-300"><Trash2 size={14} />Quitar app</button>}</div><label className="mt-4 block text-xs text-[#b7c8bc]">País<input value={valores.pais ?? 'Argentina'} onChange={(event) => setValores({ ...valores, pais: event.target.value })} className="mt-1 w-full rounded-xl border border-[#304034] bg-[#182019] px-3 py-2.5 text-white" /></label>{spec?.fields.map((field) => <label key={field} className="mt-4 block text-xs text-[#b7c8bc]">{field}<input type="password" value={valores[field] ?? ''} onChange={(event) => setValores({ ...valores, [field]: event.target.value })} className="mt-1 w-full rounded-xl border border-[#304034] bg-[#182019] px-3 py-2.5 text-white" /></label>)}<label className="mt-4 block text-xs text-[#b7c8bc]">Webhook URL<input value={valores.webhook ?? ''} onChange={(event) => setValores({ ...valores, webhook: event.target.value })} className="mt-1 w-full rounded-xl border border-[#304034] bg-[#182019] px-3 py-2.5 text-white" /></label></div><SaveRow saved={guardado} onSave={() => void guardarDelivery()} label="Guardar cambios" /></div>}
      {tipo === 'facturacion' && <div className="mt-6 space-y-3">{ARCA_FIELDS.map((field) => <label key={field} className="block text-xs text-[#b7c8bc]">{field}<input type="password" value={valores[field] ?? ''} onChange={(event) => setValores({ ...valores, [field]: event.target.value })} placeholder="Ingresá el valor" className="mt-1 w-full rounded-xl border border-[#304034] bg-[#182019] px-3 py-2.5 text-white" /></label>)}<p className="text-xs text-[#829487]">Las claves se cifran en PostgreSQL y nunca se devuelven al navegador.</p><SaveRow saved={guardado} onSave={() => void guardarArca()} label="Guardar ARCA" /></div>}
    </div>
  </div>;
}

function SaveRow({ saved, onSave, label }: { saved: boolean; onSave: () => void; label: string }) {
  return <div className="mt-4 flex items-center justify-end gap-3">{saved && <span className="mr-auto flex items-center gap-1 text-xs text-[#b7f397]"><CheckCircle2 size={14} />Guardado</span>}<button onClick={onSave} className="rounded-xl bg-[#7ed957] px-4 py-2.5 font-semibold text-[#0e0e0e]">{label}</button></div>;
}
