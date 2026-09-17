'use client';

import { useQuery } from '@tanstack/react-query';
import { obtenerReservas } from '@/hooks/lib/api/reservasApi';

export function useReservasIndex(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const query = useQuery({
    queryKey: ['reservas', 'index'],
    queryFn: obtenerReservas,
    enabled,
    staleTime: 30_000,
  });

  return {
    reservas: query.data ?? [],
    isLoading: query.isLoading,
  };
}
