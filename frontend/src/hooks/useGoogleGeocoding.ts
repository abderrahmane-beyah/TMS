import { useState, useCallback } from 'react';

interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function useGoogleGeocoding() {
  const [loading, setLoading] = useState(false);

  const geocode = useCallback(
    async (address: string): Promise<GeocodingResult | null> => {
      if (!address || address.length < 5) return null;
      if (!GOOGLE_MAPS_API_KEY) {
        console.warn('Google Maps API key not configured');
        return null;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          address: address,
          key: GOOGLE_MAPS_API_KEY,
          // Bias results to Mauritania
          components: 'country:MR',
        });

        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?${params}`
        );
        const data = await res.json();

        if (data.status === 'OK' && data.results.length > 0) {
          const result = data.results[0];
          return {
            lat: result.geometry.location.lat,
            lon: result.geometry.location.lng,
            display_name: result.formatted_address,
          };
        }
        return null;
      } catch (error) {
        console.error('Google Geocoding error:', error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { geocode, loading };
}
