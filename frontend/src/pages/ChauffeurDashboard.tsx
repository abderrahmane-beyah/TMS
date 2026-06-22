import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTournees, signalerProbleme } from '../api/tournees';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatKm, formatTime } from '../utils/formatters';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function ChauffeurDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [reportingTourneeId, setReportingTourneeId] = useState<number | null>(null);
  const [anomalieText, setAnomalieText] = useState('');

  const { data: tournees, isLoading } = useQuery({
    queryKey: ['tournees'],
    queryFn: getTournees,
  });

  const anomalieMutation = useMutation({
    mutationFn: ({ tourneeId, description }: { tourneeId: number; description: string }) =>
      signalerProbleme(tourneeId, null, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournees'] });
      setReportingTourneeId(null);
      setAnomalieText('');
      toast.success('Anomalie signalée');
    },
    onError: () => toast.error('Erreur lors du signalement'),
  });

  const today = new Date().toISOString().split('T')[0];
  const todayTournees = tournees?.filter(t => t.date === today) || [];
  const futureTournees = tournees?.filter(t => t.date > today) || [];
  const pastTournees = tournees?.filter(t => t.date < today) || [];

  return (
    <div className="mx-auto max-w-2xl px-1">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bonjour{role === 'Chauffeur' ? ', chauffeur' : ''}</h1>
        <p className="text-sm text-gray-500">Vos tournées planifiées</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="card" />
      ) : (
        <div className="space-y-4">
          {/* Tournées du jour */}
          {todayTournees.length > 0 ? (
            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-700">Aujourd'hui - {today}</h2>
              <div className="space-y-3">
                {todayTournees.map((todayTournee) => (
                  <div
                    key={todayTournee.id}
                    onClick={() => navigate(`/tournees/${todayTournee.id}`)}
                    className="cursor-pointer rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm transition-shadow active:shadow-md"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Tournée #{todayTournee.id}</h3>
                      <StatusBadge statut={todayTournee.statut} />
                    </div>

                    {/* Aperçu de la plage horaire du jour */}
                    {todayTournee.stops && todayTournee.stops.length > 0 && (() => {
                      const sortedStops = [...todayTournee.stops].sort((a, b) => a.ordre - b.ordre);
                      const firstStop = sortedStops[0];
                      const lastStop = sortedStops[sortedStops.length - 1];

                      // Pour les tournées terminées, afficher l'heure réelle de fin
                      // Pour les autres, afficher les heures prévues
                      const isCompleted = todayTournee.statut === 'TERMINEE';
                      const actualEndTime = lastStop.heure_arrivee_reelle ? formatTime(lastStop.heure_arrivee_reelle) : null;

                      const startTime = todayTournee.heure_depart
                        ? formatTime(todayTournee.heure_depart)
                        : (firstStop.heure_arrivee_prevue ? formatTime(firstStop.heure_arrivee_prevue) : null);
                      const plannedEndTime = todayTournee.heure_retour_depot
                        ? formatTime(todayTournee.heure_retour_depot)
                        : (lastStop.heure_arrivee_prevue ? formatTime(lastStop.heure_arrivee_prevue) : null);

                      // Afficher heure réelle si terminée, sinon heure prévue
                      const endTime = isCompleted && actualEndTime ? actualEndTime : plannedEndTime;

                      return startTime && endTime ? (
                        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2">
                          <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-semibold text-blue-900">
                            {startTime} - {endTime}
                            {isCompleted && actualEndTime && plannedEndTime !== actualEndTime && (
                              <span className="ml-1 text-xs text-gray-500">(prévu: {plannedEndTime})</span>
                            )}
                          </span>
                        </div>
                      ) : null;
                    })()}

                    <dl className="mb-4 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg bg-white p-3">
                        <dt className="text-[11px] text-gray-500">Arrêts</dt>
                        <dd className="text-lg font-bold text-gray-900">{todayTournee.stops?.length ?? 0}</dd>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <dt className="text-[11px] text-gray-500">Distance</dt>
                        <dd className="text-lg font-bold text-gray-900">{todayTournee.distance_totale ? formatKm(todayTournee.distance_totale) : 'N/A'}</dd>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <dt className="text-[11px] text-gray-500">Progression</dt>
                        <dd className="text-lg font-bold text-blue-600">{todayTournee.progression}%</dd>
                      </div>
                    </dl>

                    <div className="mb-4 h-2 w-full rounded-full bg-white">
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all"
                        style={{ width: `${todayTournee.progression}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Véhicule #{todayTournee.vehicule_id}</span>
                      <span className="font-medium text-blue-600">Voir les détails →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-700">Aujourd'hui - {today}</h2>
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-12">
                <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <p className="text-sm text-gray-500">Aucune tournée pour aujourd'hui</p>
              </div>
            </div>
          )}

          {/* Tournées passées */}
          {pastTournees.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-700">Tournées passées</h2>
              <div className="space-y-3">
                {pastTournees.map((t) => (
                  <div key={t.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                    <div
                      onClick={() => navigate(`/tournees/${t.id}`)}
                      className="cursor-pointer"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Tournée #{t.id}</h3>
                          <p className="text-xs text-gray-500">{t.date}</p>
                        </div>
                        <StatusBadge statut={t.statut} />
                      </div>

                      <dl className="mb-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <dt className="text-gray-500">Arrêts</dt>
                          <dd className="font-semibold text-gray-900">{t.stops?.length ?? 0}</dd>
                        </div>
                        <div className="text-center">
                          <dt className="text-gray-500">Distance</dt>
                          <dd className="font-semibold text-gray-900">{t.distance_totale ? formatKm(t.distance_totale) : 'N/A'}</dd>
                        </div>
                        <div className="text-center">
                          <dt className="text-gray-500">Progression</dt>
                          <dd className="font-semibold text-gray-900">{t.progression}%</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tournées à venir */}
          {futureTournees.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-700">Tournées à venir</h2>
              <div className="space-y-3">
                {futureTournees.map((t) => (
                  <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div
                      onClick={() => navigate(`/tournees/${t.id}`)}
                      className="cursor-pointer"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Tournée #{t.id}</h3>
                          <p className="text-xs text-gray-500">{t.date}</p>
                        </div>
                        <StatusBadge statut={t.statut} />
                      </div>

                      {/* Aperçu de la plage horaire */}
                      {t.stops && t.stops.length > 0 && (() => {
                        const sortedStops = [...t.stops].sort((a, b) => a.ordre - b.ordre);
                        const firstStop = sortedStops[0];
                        const lastStop = sortedStops[sortedStops.length - 1];

                        // Départ du dépôt et retour au dépôt (temps prévus par l'optimisation)
                        // Fallback au premier/dernier arrêt si heure_depart/heure_retour_depot non disponibles (anciennes tournées)
                        const startTime = t.heure_depart
                          ? formatTime(t.heure_depart)
                          : (firstStop.heure_arrivee_prevue ? formatTime(firstStop.heure_arrivee_prevue) : null);
                        const endTime = t.heure_retour_depot
                          ? formatTime(t.heure_retour_depot)
                          : (lastStop.heure_arrivee_prevue ? formatTime(lastStop.heure_arrivee_prevue) : null);

                        return startTime && endTime ? (
                          <div className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                            <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs font-semibold text-blue-900">
                              {startTime} - {endTime}
                            </span>
                          </div>
                        ) : null;
                      })()}

                      <dl className="mb-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <dt className="text-gray-500">Arrêts</dt>
                          <dd className="font-semibold text-gray-900">{t.stops?.length ?? 0}</dd>
                        </div>
                        <div className="text-center">
                          <dt className="text-gray-500">Distance</dt>
                          <dd className="font-semibold text-gray-900">{t.distance_totale ? formatKm(t.distance_totale) : 'N/A'}</dd>
                        </div>
                        <div className="text-center">
                          <dt className="text-gray-500">Véhicule</dt>
                          <dd className="font-semibold text-gray-900">#{t.vehicule_id}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Section de signalement d'anomalie */}
                    {reportingTourneeId === t.id ? (
                      <div className="border-t border-gray-200 pt-3">
                        <textarea
                          value={anomalieText}
                          onChange={(e) => setAnomalieText(e.target.value)}
                          placeholder="Décrivez le problème (ex: horaires irréalistes, problème de disponibilité, etc.)..."
                          rows={2}
                          className="mb-2 w-full rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!anomalieText.trim()) {
                                toast.error('Veuillez décrire le problème');
                                return;
                              }
                              anomalieMutation.mutate({
                                tourneeId: t.id,
                                description: anomalieText.trim(),
                              });
                            }}
                            disabled={anomalieMutation.isPending}
                            className="flex-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-orange-700 disabled:opacity-60"
                          >
                            {anomalieMutation.isPending ? '...' : 'Envoyer'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportingTourneeId(null);
                              setAnomalieText('');
                            }}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportingTourneeId(t.id);
                        }}
                        className="w-full border-t border-gray-200 pt-3 text-xs font-medium text-orange-600 hover:text-orange-700"
                      >
                        Signaler une anomalie
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {todayTournees.length === 0 && futureTournees.length === 0 && pastTournees.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16">
              <svg className="mb-4 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm text-gray-500">Aucune tournée assignée</p>
              <p className="mt-1 text-xs text-gray-400">Contactez le dispatcheur pour plus d'informations</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
