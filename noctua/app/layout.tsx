import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Vase Rest — Panel de Gestión',
  description: 'Sistema de administración para el restaurante Vase Rest. Gestión de mesas, pedidos, cocina y stock.',
  keywords: ['restaurante', 'gestión', 'mesas', 'pedidos', 'cocina', 'KDS'],
  icons: {
    icon: '/vaserestlogo.png',
    apple: '/vaserestlogo.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f3ee' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1714' },
  ],
};

// Se aplica el tema elegido antes del primer pintado para evitar un flash claro→oscuro.
const themeScript = `(function(){try{var t=localStorage.getItem('vase-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
