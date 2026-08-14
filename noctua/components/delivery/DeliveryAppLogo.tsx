import { Bike } from 'lucide-react';

const BRAND: Record<string, { background: string; foreground: string }> = {
  pedidosya: { background: '#e90046', foreground: '#ffffff' },
  rappi: { background: '#ff5a36', foreground: '#ffffff' },
  ubereats: { background: '#ffffff', foreground: '#111111' },
  glovo: { background: '#ffc244', foreground: '#182019' },
};

export function DeliveryAppLogo({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const id = name.toLowerCase().replace(/\s+/g, '');
  const colors = BRAND[id] ?? { background: '#26362a', foreground: '#b7f397' };
  const dimensions = size === 'sm' ? 'h-9 w-9 rounded-xl' : size === 'lg' ? 'h-16 w-16 rounded-2xl' : 'h-12 w-12 rounded-2xl';
  return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center overflow-hidden shadow-sm ${dimensions}`} style={{ backgroundColor: colors.background, color: colors.foreground }}>
    {id === 'pedidosya' && <span className="text-lg font-black italic tracking-[-0.15em]">P!</span>}
    {id === 'rappi' && <span className="text-xl font-black italic">R</span>}
    {id === 'ubereats' && <span className="flex flex-col text-center text-[8px] font-black leading-[0.9]"><span>UBER</span><span className="text-[#06c167]">EATS</span></span>}
    {id === 'glovo' && <Bike size={22} strokeWidth={2.4} />}
    {!BRAND[id] && <Bike size={22} />}
  </span>;
}
