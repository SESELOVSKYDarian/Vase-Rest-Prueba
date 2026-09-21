'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/hooks/lib/utils';
import { OCULTA_MOBILE_BOTTOM_NAV } from '@/components/layout/MobileBottomNav';
import styles from '@/app/dashboard/dashboard.module.css';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const muestraBottomNav = !OCULTA_MOBILE_BOTTOM_NAV.some((prefijo) => pathname.startsWith(prefijo));

  return (
    <div className={cn(styles.content, muestraBottomNav && styles.contentWithBottomNav)}>
      {children}
    </div>
  );
}
