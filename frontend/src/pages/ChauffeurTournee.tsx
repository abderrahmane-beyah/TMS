import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMaTournee, confirmerLivraison, signalerProbleme } from '../api/tournees';
import type { Stop } from '../api/tournees';
import StatusBadge from '../components/StatusBadge';
import MapView from '../components/MapView';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { formatTime, formatKm } from '../utils/formatters';
import type { MapMarker, MapRoute } from '../components/MapView';
import toast from 'react-hot-toast';

function buildGoogleMapsUrl(stops: Stop[]): string {
  const sorted = [...stops].sort((a, b) => a.ordre - b.ordre);
  if (sorted.length === 0) return '';

  const origin = `${sorted[0].lat},${sorted[0].lon}`;
  const destination = `${sorted[sorted.length - 1].lat},${sorted[sorted.length - 1].lon}`;
  const waypoints = sorted
    .slice(1, -1)
    .map((s) => `${s.lat},${s.lon}`)
    .join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

export default function ChauffeurTournee() {
  const queryClient = useQueryClient();
  const [problemeStopId, setProblemeStopId] = useState<number | null>(null);
  const [problemeText, setProblemeText] = useState('');

  const { data: tournee, isLoading } = useQuery({
    queryKey: ['ma-tournee'],
    queryFn: getMaTournee,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ stopId }: { stopId: number }) =>
      confirmerLivraison(tournee!.id, stopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ma-tournee'] });
      toast.success('Livraison confirmée');
    },
    onError: () => toast.error('Erreur lors de la confirmation'),
  });

  const problemeMutation = useMutation({
    mutationFn: ({ stopId, description }: { stopId: number; description: string }) =>
      signalerProbleme(tournee!.id, stopId, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ma-tournee'] });
      setProblemeStopId(null);
      setProblemeText('');
      toast.success('Problème signalé');
    },
    onError: () => toast.error('Erreur lors du signalement'),
  });

  if (isLoading) {
    return (
      <div className="px-1">
        <LoadingSkeleton type="card" />
        <div className="mt-6"><LoadingSkeleton rows={4} /></div>
      </div>
    );
  }

  if (!tournee) {
    return (
      <div className="px-1">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Ma tournée</h1>
        <EmptyState message="Aucune tournée assignée pour aujourd'hui" />
      </div>
    );
  }

  const sortedStops = [...(tournee.stops ?? [])].sort((a, b) => a.ordre - b.ordre);

  const markers: MapMarker[] = sortedStops.map((s) => ({
    lat: s.lat,
    lon: s.lon,
    statut: s.statut,
    popup: `Arrêt ${s.ordre} — ${s.adresse}`,
  }));

  const routePoints: [number, number][] = sortedStops.map((s) => [s.lat, s.lon]);
  const routes: MapRoute[] = routePoints.length > 1
    ? [{ points: routePoints, color: '#3b82f6' }]
    : [];

  const googleMapsUrl = buildGoogleMapsUrl(sortedStops);
  const deliveredCount = sortedStops.filter((s) => s.statut === 'LIVRÉE').length;

  return (
    <div className="mx-auto max-w-2xl px-1">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Ma tournée</h1>
        <p className="text-sm text-gray-500">
          Véhicule #{tournee.vehicule_id} — {tournee.distance_totale ? formatKm(tournee.distance_totale) : 'Distance à calculer'}
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm">
          <p className="text-[11px] text-gray-500">Arrêts</p>
          <p className="text-lg font-bold text-gray-900">{sortedStops.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm">
          <p className="text-[11px] text-gray-500">Livrés</p>
          <p className="text-lg font-bold text-green-600">{deliveredCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm">
          <p className="text-[11px] text-gray-500">Statut</p>
          <div className="mt-0.5"><StatusBadge statut={tournee.statut} /></div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>Progression</span>
          <span>{tournee.progression}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-gray-200">
          <div
            className="h-2.5 rounded-full bg-blue-600 transition-all"
            style={{ width: `${tournee.progression}%` }}
          />
        </div>
      </div>

      {/* Map */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <MapView markers={markers} routes={routes} className="h-56 sm:h-72" />
      </div>

      {/* Google Maps button */}
      {sortedStops.length > 0 && (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm active:bg-blue-700"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
          </svg>
          Ouvrir dans Google Maps
        </a>
      )}

      {/* Stops list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Arrêts</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {sortedStops.map((stop) => (
            <div key={stop.id} className="px-4 py-4">
              {/* Stop header row */}
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    stop.statut === 'LIVRÉE'
                      ? 'bg-purple-100 text-purple-700'
                      : stop.statut === 'EN_COURS'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {stop.ordre}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      Commande #{stop.commande_id}
                    </p>
                    <StatusBadge statut={stop.statut} />
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">{stop.adresse}</p>
                  <div className="mt-1 flex gap-3 text-xs text-gray-500">
                    {stop.heure_arrivee_prevue && (
                      <span>Prévu : {formatTime(stop.heure_arrivee_prevue)}</span>
                    )}
                    {stop.heure_arrivee_reelle && (
                      <span className="text-green-600">Réel : {formatTime(stop.heure_arrivee_reelle)}</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  {stop.statut !== 'LIVRÉE' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => confirmMutation.mutate({ stopId: stop.id })}
                        disabled={confirmMutation.isPending}
                        className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white active:bg-green-700 disabled:opacity-60"
                      >
                        {confirmMutation.isPending ? '...' : 'Confirmer la livraison'}
                      </button>
                      <button
                        onClick={() => setProblemeStopId(problemeStopId === stop.id ? null : stop.id)}
                        className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 active:bg-red-100"
                      >
                        Signaler
                      </button>
                    </div>
                  )}

                  {/* Delivered checkmark */}
                  {stop.statut === 'LIVRÉE' && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-600">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Livraison confirmée
                    </div>
                  )}

                  {/* Problem form */}
                  {problemeStopId === stop.id && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <textarea
                        value={problemeText}
                        onChange={(e) => setProblemeText(e.target.value)}
                        placeholder="Décrivez le problème..."
                        rows={2}
                        className="mb-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!problemeText.trim()) {
                              toast.error('Veuillez décrire le problème');
                              return;
                            }
                            problemeMutation.mutate({
                              stopId: stop.id,
                              description: problemeText.trim(),
                            });
                          }}
                          disabled={problemeMutation.isPending}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-red-700 disabled:opacity-60"
                        >
                          {problemeMutation.isPending ? '...' : 'Envoyer'}
                        </button>
                        <button
                          onClick={() => { setProblemeStopId(null); setProblemeText(''); }}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
