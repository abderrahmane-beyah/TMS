import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTournee } from '../api/tournees';
import StatusBadge from '../components/StatusBadge';
import MapView from '../components/MapView';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatTime } from '../utils/formatters';
import type { MapMarker, MapRoute } from '../components/MapView';

export default function TourneeDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: tournee, isLoading } = useQuery({
    queryKey: ['tournee', id],
    queryFn: () => getTournee(Number(id)),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSkeleton type="text" rows={10} />;
  if (!tournee) return <p className="text-gray-500">Tournée introuvable</p>;

  const markers: MapMarker[] =
    tournee.stops?.map((stop) => ({
      lat: stop.lat,
      lon: stop.lon,
      statut: stop.statut,
      popup: `Arrêt #${stop.ordre} — Commande #${stop.commande_id}`,
    })) ?? [];

  const routePoints: [number, number][] =
    tournee.stops
      ?.sort((a, b) => a.ordre - b.ordre)
      .map((s) => [s.lat, s.lon] as [number, number]) ?? [];

  const routes: MapRoute[] = routePoints.length > 1 ? [{ points: routePoints, color: '#3b82f6' }] : [];

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Tournée #{tournee.id}</h1>
        <StatusBadge statut={tournee.statut} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Chauffeur</p>
          <p className="mt-1 font-semibold text-gray-900">#{tournee.chauffeur_id}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Véhicule</p>
          <p className="mt-1 font-semibold text-gray-900">#{tournee.vehicule_id}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Arrêts</p>
          <p className="mt-1 font-semibold text-gray-900">{tournee.stops?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Distance</p>
          <p className="mt-1 font-semibold text-gray-900">{tournee.distance_totale ? tournee.distance_totale.toFixed(1) + ' km' : 'N/A'}</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Carte */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-900">Itinéraire</h2>
          <MapView markers={markers} routes={routes} className="h-96" />
        </div>

        {/* Arrêts */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Séquence des arrêts</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {tournee.stops
              ?.sort((a, b) => a.ordre - b.ordre)
              .map((stop) => (
                <div key={stop.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    {stop.ordre}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Commande #{stop.commande_id}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{stop.adresse}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {stop.heure_arrivee_prevue && (
                      <p className="text-xs text-gray-500">
                        Prévu : {formatTime(stop.heure_arrivee_prevue)}
                      </p>
                    )}
                    {stop.heure_arrivee_reelle && (
                      <p className="text-xs text-green-600">
                        Réel : {formatTime(stop.heure_arrivee_reelle)}
                      </p>
                    )}
                  </div>
                  <StatusBadge statut={stop.statut} />
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
