import { useState, useEffect } from 'react';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute (in case user leaves app open across 12hr boundary)

/**
 * Returns 0 or 1 based on 12-hour windows. Alternates every 12 hours.
 * 0 = Default theme, 1 = Alternate theme
 */
export function useLoginTheme() {
  const [themeIndex, setThemeIndex] = useState(() =>
    Math.floor(Date.now() / TWELVE_HOURS_MS) % 2
  );

  useEffect(() => {
    const check = () => {
      setThemeIndex(Math.floor(Date.now() / TWELVE_HOURS_MS) % 2);
    };
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return themeIndex;
}
