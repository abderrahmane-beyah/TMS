import { useState, useCallback, useRef } from 'react';
import { NOMINATIM_URL } from '../utils/constants';

interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
}

export function useGeocoding() {
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const geocode = useCallback(
    async (address: string): Promise<GeocodingResult | null> => {
      if (!address || address.length < 5) return null;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: address,
          format: 'json',
          limit: '1',
        });
        const res = await fetch(`${NOMINATIM_URL}/search?${params}`);
        const data = await res.json();
        if (data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
            display_name: data[0].display_name,
          };
        }
        return null;
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const geocodeDebounced = useCallback(
    (address: string): Promise<GeocodingResult | null> => {
      return new Promise((resolve) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(async () => {
          const result = await geocode(address);
          resolve(result);
        }, 500);
      });
    },
    [geocode]
  );

  return { geocode, geocodeDebounced, loading };
}
