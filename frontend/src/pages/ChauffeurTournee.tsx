import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmerLivraison, signalerProbleme, demarrerTournee, terminerTournee } from '../api/tournees';
import StatusBadge from '../components/StatusBadge';
import MapView from '../components/MapView';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { formatTime, formatKm } from '../utils/formatters';
import type { MapMarker, MapRoute } from '../components/MapView';
import toast from 'react-hot-toast';

export default function ChauffeurTournee() {
  const queryClient = useQueryClient();
  const [problemeStopId, setProblemeStopId] = useState<number | null>(null);
  const [problemeText, setProblemeText] = useState('');
  const [showTourneeProbleme, setShowTourneeProbleme] = useState(false);
  const [tourneeProblemeText, setTourneeProblemeText] = useState('');
  const [selectedTourneeId, setSelectedTourneeId] = useState<number | null>(null);

  const { data: allTournees, isLoading } = useQuery({
    queryKey: ['tournees', 'chauffeur'],  
    queryFn: async () => {
      const { getTournees } = await import('../api/tournees');
      return getTournees();
    },
  });

  // Filter today's tournees
  const today = new Date().toISOString().split('T')[0];
  const todayTournees = allTournees?.filter(t => t.date === today) || [];

  // Auto-select first EN_COURS or PLANIFIEE tournee, or use selected
  const tournee = todayTournees.length > 0
    ? (selectedTourneeId
        ? todayTournees.find(t => t.id === selectedTourneeId)
        : todayTournees.find(t => t.statut === 'EN_COURS')
          || todayTournees.find(t => t.statut === 'PLANIFIEE')
          || todayTournees[0])
    : undefined;

  const confirmMutation = useMutation({
    mutationFn: ({ stopId }: { stopId: number }) =>
      confirmerLivraison(tournee!.id, stopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournees'] });
      toast.success('Livraison confirmée');
    },
    onError: () => toast.error('Erreur lors de la confirmation'),
  });

  const problemeMutation = useMutation({
    mutationFn: ({ stopId, description }: { stopId: number; description: string }) =>
      signalerProbleme(tournee!.id, stopId, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournees'] });
      setProblemeStopId(null);
      setProblemeText('');
      toast.success('Problème signalé');
    },
    onError: () => toast.error('Erreur lors du signalement'),
  });

  const tourneeProblemeMutation = useMutation({
    mutationFn: ({ description }: { description: string }) =>
      signalerProbleme(tournee!.id, null, description), // stopId null = anomalie au niveau tournée
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournees'] });
      setShowTourneeProbleme(false);
      setTourneeProblemeText('');
      toast.success('Anomalie signalée');
    },
    onError: () => toast.error('Erreur lors du signalement'),
  });

  const demarrerMutation = useMutation({
    mutationFn: () => demarrerTournee(tournee!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournees'] });
      toast.success('Tournée démarrée');
    },
    onError: () => toast.error('Erreur lors du démarrage'),
  });

  const terminerMutation = useMutation({
    mutationFn: () => terminerTournee(tournee!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournees'] });
      toast.success('Tournée terminée');
    },
    onError: () => toast.error('Erreur lors de la terminaison'),
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

  // Exclure les commandes annulées dans la vue chauffeur
  const activeStops = (tournee.stops ?? []).filter(s => s.commande_statut !== 'ANNULEE');
  const sortedStops = [...activeStops].sort((a, b) => a.ordre - b.ordre);

  // Coordonnées du dépôt depuis la tournée
  const depotLat = tournee.depot_lat;
  const depotLon = tournee.depot_lon;

  // Construire les marqueurs - inclure le dépôt si les coordonnées existent
  const markers: MapMarker[] = [];
  if (depotLat && depotLon) {
    markers.push({
      lat: depotLat,
      lon: depotLon,
      statut: 'DISPONIBLE', // Utiliser un statut neutre pour le dépôt
      popup: 'Dépôt (Départ)',
    });
  }
  markers.push(...sortedStops.map((s) => ({
    lat: s.lat,
    lon: s.lon,
    statut: s.statut,
    popup: `Arrêt ${s.ordre} — ${s.adresse}`,
  })));

  // Itinéraire : Dépôt -> Arrêt 1 -> Arrêt 2 -> ... -> Dernier arrêt
  const routePoints: [number, number][] = [];
  if (depotLat && depotLon) {
    routePoints.push([depotLat, depotLon]);
  }
  routePoints.push(...sortedStops.map((s) => [s.lat, s.lon] as [number, number]));

  const routes: MapRoute[] = routePoints.length > 1
    ? [{ points: routePoints, color: '#3b82f6' }]
    : [];

  const deliveredCount = sortedStops.filter((s) => s.statut === 'LIVREE').length;
  const allActiveStopsDelivered = sortedStops.length > 0 && deliveredCount === sortedStops.length;

  return (
    <div className="mx-auto max-w-2xl px-1">
      {/* En-tête */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Ma tournée</h1>
        <p className="text-sm text-gray-500">
          Véhicule #{tournee.vehicule_id} — {tournee.distance_totale ? formatKm(tournee.distance_totale) : 'Distance à calculer'}
        </p>
      </div>

      {/* Sélecteur de tournée (si plusieurs tournées aujourd'hui) */}
      {todayTournees.length > 1 && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Vous avez {todayTournees.length} tournées aujourd'hui - Sélectionnez :
          </label>
          <select
            value={tournee?.id || ''}
            onChange={(e) => setSelectedTourneeId(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {todayTournees.map((t) => (
              <option key={t.id} value={t.id}>
                Tournée #{t.id} - {t.stops?.length || 0} arrêts - {t.statut}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Cartes récapitulatives */}
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

      {/* Barre de progression */}
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

      {/* Boutons démarrer/terminer la tournée */}
      <div className="mb-5 flex flex-col gap-3">
        {tournee.statut === 'PLANIFIEE' && (
          <>
            <button
              onClick={() => {
                if (sortedStops.length === 0) {
                  toast.error('Impossible de démarrer : aucun arrêt actif dans cette tournée');
                  return;
                }
                demarrerMutation.mutate();
              }}
              disabled={demarrerMutation.isPending || sortedStops.length === 0}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {demarrerMutation.isPending ? 'Démarrage...' : '🚀 Démarrer la tournée'}
            </button>
            {sortedStops.length === 0 && (
              <p className="text-center text-xs text-red-600">
                ⚠️ Tous les arrêts de cette tournée ont été annulés. Contactez votre dispatcheur.
              </p>
            )}
          </>
        )}
        {tournee.statut === 'EN_COURS' && allActiveStopsDelivered && (
          <button
            onClick={() => terminerMutation.mutate()}
            disabled={terminerMutation.isPending}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {terminerMutation.isPending ? 'Terminaison...' : 'Terminer la tournée'}
          </button>
        )}
      </div>

      {/* Carte */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <MapView markers={markers} routes={routes} className="h-56 sm:h-72" />
      </div>

      {/* Signaler un problème au niveau tournée */}
      {!showTourneeProbleme ? (
        <button
          onClick={() => setShowTourneeProbleme(true)}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 shadow-sm active:bg-orange-100"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Signaler une anomalie sur cette tournée
        </button>
      ) : (
        <div className="mb-6 rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-orange-900">Signaler une anomalie</h3>
          <p className="mb-3 text-xs text-orange-700">
            Décrivez un problème général concernant cette tournée (ex: problème véhicule, horaires irréalistes, etc.)
          </p>
          <textarea
            value={tourneeProblemeText}
            onChange={(e) => setTourneeProblemeText(e.target.value)}
            placeholder="Décrivez le problème..."
            rows={3}
            className="mb-3 w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!tourneeProblemeText.trim()) {
                  toast.error('Veuillez décrire le problème');
                  return;
                }
                tourneeProblemeMutation.mutate({
                  description: tourneeProblemeText.trim(),
                });
              }}
              disabled={tourneeProblemeMutation.isPending}
              className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white active:bg-orange-700 disabled:opacity-60"
            >
              {tourneeProblemeMutation.isPending ? 'Envoi...' : 'Envoyer l\'anomalie'}
            </button>
            <button
              onClick={() => { setShowTourneeProbleme(false); setTourneeProblemeText(''); }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 active:bg-gray-100"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des arrêts */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Arrêts</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {sortedStops.map((stop) => (
            <div key={stop.id} className="px-4 py-4">
              {/* Ligne d'en-tête de l'arrêt */}
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    stop.statut === 'LIVREE'
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

                  {/* Boutons d'action */}
                  <div className="mt-3 flex gap-2">
                    {/* Bouton Google Maps pour cet arrêt */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 active:bg-blue-100"
                      title="Ouvrir dans Google Maps"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
                      </svg>
                    </a>

                    {stop.statut !== 'LIVREE' && (
                      <>
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
                      </>
                    )}
                  </div>

                  {/* Indicateur de livraison confirmée */}
                  {stop.statut === 'LIVREE' && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-600">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Livraison confirmée
                    </div>
                  )}

                  {/* Formulaire de signalement */}
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
