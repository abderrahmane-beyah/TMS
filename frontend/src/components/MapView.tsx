import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MARKER_COLORS } from '../utils/constants';
import { useEffect, useState } from 'react';
import { fetchOSRMRoute } from '../utils/osrm';

function createIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export interface MapMarker {
  lat: number;
  lon: number;
  statut: string;
  popup?: string;
}

export interface MapRoute {
  points: [number, number][];
  color: string;
}

interface MapViewProps {
  markers?: MapMarker[];
  routes?: MapRoute[];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lon]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [markers, map]);
  return null;
}

function OSRMRoute({ points, color }: { points: [number, number][]; color: string }) {
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>(points);

  useEffect(() => {
    // Fetch OSRM route on mount or when points change
    fetchOSRMRoute(points).then(setRouteGeometry);
  }, [points]);

  return <Polyline positions={routeGeometry} pathOptions={{ color, weight: 3 }} />;
}

export default function MapView({
  markers = [],
  routes = [],
  center = [48.8566, 2.3522],
  zoom = 6,
  className = 'h-80',
}: MapViewProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`rounded-xl ${className}`}
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {markers.length > 0 && <FitBounds markers={markers} />}

      {markers.map((m, i) => (
        <Marker
          key={i}
          position={[m.lat, m.lon]}
          icon={createIcon(MARKER_COLORS[m.statut] || '#6b7280')}
        >
          {m.popup && <Popup>{m.popup}</Popup>}
        </Marker>
      ))}

      {routes.map((route, i) => (
        <OSRMRoute key={i} points={route.points} color={route.color} />
      ))}
    </MapContainer>
  );
}
