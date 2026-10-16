import React, { useEffect, useRef, useState } from 'react';

// Animated number that counts up on mount. format: (n) => string.
export default function CountUp({ value, format, duration = 900 }) {
  const [n, setN] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const target = Number(value) || 0;
    const t0 = performance.now();
    const tick = t => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setN(target * eased);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <>{format ? format(n) : Math.round(n)}</>;
}
