// Ilustraciones de línea propias de Vase Rest. Cada trazo usa pathLength=1 y se "dibuja"
// con stroke-dashoffset (animación CSS, fuera del hilo principal), escalonado con
// --d. Con prefers-reduced-motion la animación dura 1ms: aparecen ya dibujadas.
import type { CSSProperties, SVGProps } from 'react';

type IllustrationProps = SVGProps<SVGSVGElement> & { animate?: boolean };

function stroke(delay: number, animate: boolean): { style?: CSSProperties; pathLength: number; className?: string } {
  if (!animate) return { pathLength: 1 };
  return {
    pathLength: 1,
    className: 'illustration-stroke',
    style: { '--d': `${delay}ms` } as CSSProperties,
  };
}

/** Mesa servida: plato, cubiertos, copa y un brote de la marca. Hero del login. */
export function TableSetting({ animate = true, ...props }: IllustrationProps) {
  return (
    <svg viewBox="0 0 360 260" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <g stroke="currentColor" strokeWidth={1.6}>
        {/* mantel: una línea de horizonte suave */}
        <path d="M18 214 C 110 206, 250 206, 342 214" {...stroke(0, animate)} opacity={0.5} />
        {/* plato */}
        <circle cx={170} cy={150} r={70} {...stroke(120, animate)} />
        <circle cx={170} cy={150} r={50} {...stroke(260, animate)} opacity={0.55} />
        {/* tenedor */}
        <path d="M70 92 V 128 M78 92 V 128 M86 92 V 128 M70 128 C 70 140, 86 140, 86 128 M78 138 V 214" {...stroke(380, animate)} />
        {/* cuchillo */}
        <path d="M268 92 C 284 108, 284 136, 272 146 V 214 M268 92 V 146" {...stroke(480, animate)} />
        {/* copa */}
        <path d="M300 40 H 336 C 336 70, 326 82, 318 84 C 310 82, 300 70, 300 40 Z M318 84 V 118 M306 120 H 330" {...stroke(600, animate)} />
      </g>
      {/* brote de la marca, en el centro del plato */}
      <g stroke="var(--brand)" strokeWidth={1.8}>
        <path d="M170 172 C 170 156, 172 142, 180 130" {...stroke(760, animate)} />
        <path d="M172 150 C 160 146, 152 136, 154 124 C 166 126, 173 136, 172 150 Z" {...stroke(860, animate)} />
        <path d="M177 138 C 186 130, 198 130, 204 136 C 196 144, 184 145, 177 138 Z" {...stroke(940, animate)} />
      </g>
      {/* vapor: respira suave, es decorativo */}
      <g stroke="currentColor" strokeWidth={1.4} opacity={0.35} className={animate ? 'illustration-steam' : undefined}>
        <path d="M150 62 C 142 52, 158 44, 150 32" />
        <path d="M172 58 C 164 46, 180 38, 172 24" />
        <path d="M194 62 C 186 52, 202 44, 194 32" />
      </g>
    </svg>
  );
}

/** Plato vacío con cloche: estados vacíos (sin platos, sin clientes, sin resultados). */
export function EmptyCloche({ animate = true, ...props }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 150" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <g stroke="currentColor" strokeWidth={1.6}>
        <path d="M24 118 H 176" {...stroke(0, animate)} />
        <path d="M38 118 C 38 72, 72 46, 100 46 C 128 46, 162 72, 162 118" {...stroke(140, animate)} />
        <path d="M100 46 V 36 M92 34 H 108" {...stroke(320, animate)} />
        <path d="M58 104 C 62 86, 74 72, 88 66" {...stroke(420, animate)} opacity={0.45} />
        <path d="M44 128 C 80 134, 120 134, 156 128" {...stroke(520, animate)} opacity={0.4} />
      </g>
      <circle cx={100} cy={31} r={2.4} fill="var(--brand)" className={animate ? 'illustration-pop' : undefined} />
    </svg>
  );
}

/** Lupa sobre un mantel: búsquedas sin resultados. */
export function EmptySearch({ animate = true, ...props }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 150" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <g stroke="currentColor" strokeWidth={1.6}>
        <path d="M24 120 H 176" {...stroke(0, animate)} opacity={0.45} />
        <circle cx={92} cy={70} r={30} {...stroke(120, animate)} />
        <path d="M114 92 L 140 118" strokeWidth={2.4} {...stroke(360, animate)} />
      </g>
      <path d="M80 62 C 84 56, 92 54, 98 56" stroke="var(--brand)" strokeWidth={1.8} {...stroke(520, animate)} />
    </svg>
  );
}
