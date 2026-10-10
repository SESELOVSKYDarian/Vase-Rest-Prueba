import { useQuery, QueryClient } from '@tanstack/react-query';
import { obtenerCategorias, obtenerMesas, obtenerPedidosActivos, obtenerProductos } from '@vase/api';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 4000, retry: 1, refetchOnWindowFocus: true } },
});

// Mientras no hay tiempo real por SSE (fase 2), el salón se refresca cada 5 s.
export const useMesas = () => useQuery({ queryKey: ['mesas'], queryFn: obtenerMesas, refetchInterval: 5000 });
export const usePedidosActivos = () => useQuery({ queryKey: ['pedidos', 'activos'], queryFn: obtenerPedidosActivos, refetchInterval: 5000 });
export const useCategorias = () => useQuery({ queryKey: ['menu', 'categorias'], queryFn: obtenerCategorias, staleTime: 60_000 });
export const useProductos = () => useQuery({ queryKey: ['menu', 'productos'], queryFn: obtenerProductos, staleTime: 60_000 });
