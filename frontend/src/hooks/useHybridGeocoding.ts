import { useState, useCallback } from 'react';
import { NOMINATIM_URL } from '../utils/constants';

interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function useHybridGeocoding() {
  const [loading, setLoading] = useState(false);

  // Essayer Nominatim d'abord (gratuit)
  const geocodeNominatim = async (
    address: string
  ): Promise<GeocodingResult | null> => {
    try {
      const params = new URLSearchParams({
        q: address,
        format: 'json',
        limit: '1',
        countrycodes: 'mr', // Mauritanie seulement
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
    } catch (error) {
      console.warn('Nominatim failed:', error);
      return null;
    }
  };

  // Fallback: Google Maps (payant mais plus précis)
  const geocodeGoogle = async (
    address: string
  ): Promise<GeocodingResult | null> => {
    if (!GOOGLE_MAPS_API_KEY) return null;

    try {
      const params = new URLSearchParams({
        address: address,
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
      console.warn('Google Geocoding failed:', error);
      return null;
    }
  };

  const geocode = useCallback(
    async (address: string): Promise<GeocodingResult | null> => {
      if (!address || address.length < 5) return null;

      setLoading(true);
      try {
        // 1. Essayer Nominatim d'abord (gratuit)
        console.log('[Geocoding] Trying Nominatim...');
        let result = await geocodeNominatim(address);

        // 2. Si échec, essayer Google Maps (si clé API disponible)
        if (!result && GOOGLE_MAPS_API_KEY) {
          console.log('[Geocoding] Nominatim failed, trying Google Maps...');
          result = await geocodeGoogle(address);
        }

        if (result) {
          console.log('[Geocoding] Success:', result.display_name);
        } else {
          console.warn('[Geocoding] All services failed for:', address);
        }

        return result;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { geocode, loading };
}
