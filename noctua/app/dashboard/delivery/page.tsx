"use client";

import { motion } from 'framer-motion';
import { PlatformCard } from '@/components/delivery/PlatformCard';
import { useDeliveryStore } from '@/store/deliveryStore';
import { useSuperAdmStore } from '@/store/superadmStore';
import { useEffect, useState } from 'react';
import type { PlatformId } from '@/types';
import { ConfiguracionIntegracionModal } from '@/components/integraciones/ConfiguracionIntegracionModal';
import { MoreHorizontal, Plus } from 'lucide-react';

// Map for platform colors, can extend as needed
const platformColorMap: Record<string, string> = {
  'PedidosYa': '#FF0F50',
  'Rappi': '#FF441F',
  'Glovo': '#FFC244',
  'Uber Eats': '#06C167',
};

// Function to map app name to PlatformId (with safe fallback)
const mapAppNameToId = (name: string): PlatformId => {
  const id = name.toLowerCase().replace(/\s/g, '') as PlatformId;
  // Validate it's a valid PlatformId, else default to 'pedidosya'
  if (['pedidosya', 'rappi', 'glovo', 'ubereats'].includes(id)) {
    return id;
  }
  return 'pedidosya';
};

export default function DeliveryPage() {
  const [configuracionAbierta, setConfiguracionAbierta] = useState(false);
  const [appSeleccionada, setAppSeleccionada] = useState<import('@/types/superadm').DeliveryApp | null>(null);
  const { getPendingCount, ordersByPlatform } = useDeliveryStore();
  const { config, initializeConfig } = useSuperAdmStore();
  const texts = config.theme.dashboardTexts?.delivery || { title: 'Delivery', subtitle: 'Gestiona pedidos de todas las plataformas' };
  
  useEffect(() => {
    initializeConfig();
  }, [initializeConfig]);

  const activeApps = config.deliveryApps?.filter(app => app.isActive) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{texts.title}</h1>
        <div className="flex items-center justify-between gap-3"><p className="text-[#676b67] text-sm">{texts.subtitle}</p><button onClick={() => { setAppSeleccionada(null); setConfiguracionAbierta(true); }} className="flex items-center gap-2 rounded-xl border border-[#304034] px-3 py-2 text-xs font-semibold text-[#b7c8bc] hover:border-[#7ed957] hover:text-[#b7f397]"><Plus size={15} />Agregar app</button></div>
      </div>
      <ConfiguracionIntegracionModal tipo="delivery" abierto={configuracionAbierta} appInicial={appSeleccionada} onClose={() => setConfiguracionAbierta(false)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeApps.map((app, index) => {
          const platformId = mapAppNameToId(app.name);
          return (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="group relative" onContextMenu={(event) => { event.preventDefault(); setAppSeleccionada(app); setConfiguracionAbierta(true); }}><PlatformCard
                platform={platformId}
                displayName={app.name}
                color={platformColorMap[app.name] || '#8b5cf6'}
                pendingCount={getPendingCount(platformId)}
                lastOrderTime={ordersByPlatform[platformId]?.[0]?.createdAt}
              /><button onClick={() => { setAppSeleccionada(app); setConfiguracionAbierta(true); }} aria-label={`Editar ${app.name}`} className="absolute right-4 top-4 rounded-lg p-2 text-[#829487] opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white"><MoreHorizontal size={19} /></button></div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
