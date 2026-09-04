import { useState, useEffect } from 'react';

export function useLiveTime(updateIntervalMs: number = 1000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), updateIntervalMs);
    return () => clearInterval(id);
  }, [updateIntervalMs]);

  return now;
}
