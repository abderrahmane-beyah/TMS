import { useState, useCallback } from 'react';
import { NOMINATIM_URL } from '../utils/constants';

interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const geocodeWithGoogle = async (
  address: string
): Promise<GeocodingResult | null> => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Clé API Google Maps non configurée, repli vers Nominatim');
    return null;
  }

  try {
    const params = new URLSearchParams({
      address,
      key: GOOGLE_MAPS_API_KEY,
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
    console.warn('Échec du géocodage Google, repli vers Nominatim:', error);
    return null;
  }
};

const geocodeWithNominatim = async (
  address: string
): Promise<GeocodingResult | null> => {
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'mr',
    });

    const res = await fetch(`${NOMINATIM_URL}/search?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name,
      };
    }
    return null;
  } catch (error) {
    console.warn('Échec du géocodage Nominatim:', error);
    return null;
  }
};

export function useGoogleGeocoding() {
  const [loading, setLoading] = useState(false);

  const geocode = useCallback(
    async (address: string): Promise<GeocodingResult | null> => {
      if (!address || address.length < 5) return null;

      setLoading(true);
      try {
        // Google reste prioritaire ; Nominatim ne sert que de repli.
        const googleResult = await geocodeWithGoogle(address);
        if (googleResult) return googleResult;

        return await geocodeWithNominatim(address);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { geocode, loading };
}
