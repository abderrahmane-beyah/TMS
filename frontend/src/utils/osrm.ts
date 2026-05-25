/**
 * Récupère la géométrie d'itinéraire depuis OSRM.
 * Retourne un tableau de coordonnées [lat, lon] suivant les routes réelles.
 */
export async function fetchOSRMRoute(
  coordinates: [number, number][]
): Promise<[number, number][]> {
  if (coordinates.length < 2) return coordinates;

  // OSRM attend le format lon,lat
  const coords = coordinates.map(([lat, lon]) => `${lon},${lat}`).join(';');

  // Utiliser le serveur OSRM local s'il est disponible, sinon le serveur de démonstration public
  const osrmBaseUrl = import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org';
  const osrmUrl = `${osrmBaseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(osrmUrl);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      // Extraire la géométrie et reconvertir en [lat, lon]
      const geometry = data.routes[0].geometry.coordinates;
      return geometry.map(([lon, lat]: [number, number]) => [lat, lon]);
    }

    // Repli sur des segments droits si OSRM échoue
    return coordinates;
  } catch (error) {
    console.warn('Échec de récupération de l\'itinéraire OSRM, utilisation de lignes droites:', error);
    return coordinates;
  }
}
