'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
  className?: string;
}

// Cuenta hasta el valor al aparecer y cuando cambia (estado que se actualiza con
// polling: el cambio se lee como "algo pasó", no como un salto). Sin movimiento
// si el usuario pidió reducir animaciones.
export function AnimatedNumber({ value, format = (v) => String(Math.round(v)), className }: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const fromRef = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      fromRef.current = value;
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }
    const controls = animate(fromRef.current, value, {
      duration: 0.9,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => setDisplay(v),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return <span className={`tabular ${className ?? ''}`}>{format(display)}</span>;
}
