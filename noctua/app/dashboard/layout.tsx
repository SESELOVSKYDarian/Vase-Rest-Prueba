import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { DashboardContent } from "@/components/layout/DashboardContent";
import { PedidoListoAlerta } from "@/components/mesas/PedidoListoAlerta";
import styles from "./dashboard.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.dashboard}>
      <Sidebar />

      <main className={styles.main}>
        <Navbar />

        <DashboardContent>{children}</DashboardContent>
      </main>

      {/* Notificación global — activa en todas las páginas del dashboard */}
      <PedidoListoAlerta />

      {/* Búsqueda global (⌘K/Ctrl+K) — activa en todas las páginas del dashboard */}
      <CommandPalette />

      {/* Acceso rápido con el pulgar en mobile/tablet — complementa al hamburguesa+drawer */}
      <MobileBottomNav />
    </div>
  );
}