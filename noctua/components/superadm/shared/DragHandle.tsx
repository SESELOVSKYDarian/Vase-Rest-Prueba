'use client';

import { GripVertical } from 'lucide-react';

export function DragHandle() {
  return (
    <div className="cursor-grab active:cursor-grabbing text-ink-3 hover:text-ink">
      <GripVertical size={16} />
    </div>
  );
}
