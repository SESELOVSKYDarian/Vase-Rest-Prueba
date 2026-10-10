import { useQuery, QueryClient } from '@tanstack/react-query';
import { obtenerAjustes, obtenerAvisos, obtenerCategorias, obtenerMesas, obtenerPedidosActivos, obtenerPlano, obtenerProductos } from '@vase/api';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 4000, retry: 1, refetchOnWindowFocus: true } },
});

// Mientras no hay tiempo real por SSE (fase 2), el salón se refresca cada 5 s.
export const useMesas = () => useQuery({ queryKey: ['mesas'], queryFn: obtenerMesas, refetchInterval: 5000 });
export const usePedidosActivos = () => useQuery({ queryKey: ['pedidos', 'activos'], queryFn: obtenerPedidosActivos, refetchInterval: 5000 });
export const useCategorias = () => useQuery({ queryKey: ['menu', 'categorias'], queryFn: obtenerCategorias, staleTime: 60_000 });
export const useProductos = () => useQuery({ queryKey: ['menu', 'productos'], queryFn: obtenerProductos, staleTime: 60_000 });
export const usePlano = () => useQuery({ queryKey: ['plano'], queryFn: obtenerPlano, staleTime: 30_000 });

/** Pedidos y llamados del QR y transferencias por confirmar. Solo para quienes atienden el salón. */
export const useAvisos = (habilitado = true) => useQuery({ queryKey: ['avisos'], queryFn: obtenerAvisos, refetchInterval: 5000, enabled: habilitado });
export const useAjustes = () => useQuery({ queryKey: ['ajustes-carta'], queryFn: obtenerAjustes, staleTime: 15_000 });
