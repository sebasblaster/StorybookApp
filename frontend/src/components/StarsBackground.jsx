import React, { useMemo } from "react";

export default function StarsBackground() {
  const stars = useMemo(() => {
    return Array.from({ length: 70 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      size: Math.random() < 0.15 ? 3 : 2,
    }));
  }, []);
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden>
      {stars.map((s) => (
        <span
          key={s.id}
          className="star"
          style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
        />
      ))}
    </div>
  );
}
