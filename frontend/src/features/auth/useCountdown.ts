import { useEffect, useState } from 'react';

/** Seconds remaining until a resend is allowed (matches the API's 45 s cooldown). */
export function useCountdown(initial = 45) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, restart: () => setLeft(initial) };
}
