import { useQuery, useMutation } from '@tanstack/react-query';
import { getCommandes } from '../api/commandes';
import { getTournees } from '../api/tournees';
import { getVehicules } from '../api/vehicules';
import { getWarehouses } from '../api/warehouses';
import { lancerOptimisation } from '../api/optimisation';
import { getOtd } from '../api/kpis';
import KpiCard from '../components/KpiCard';
import StatusBadge from '../components/StatusBadge';
import MapView from '../components/MapView';
import LoadingSkeleton from '../components/LoadingSkeleton';
import type { MapMarker, MapRoute } from '../components/MapView';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useOptimisationPolling } from '../hooks/useOptimisationPolling';

const ROUTE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [tacheId, setTacheId] = useState<number | null>(null);

  const { data: commandes, isLoading: loadingCommandes } = useQuery({
    queryKey: ['commandes', { skip: 0, limit: 20 }],
    queryFn: () => getCommandes({ skip: 0, limit: 20 }),
  });

  const { data: tournees, isLoading: loadingTournees } = useQuery({
    queryKey: ['tournees'],
    queryFn: () => getTournees(),
  });

  const { data: vehicules } = useQuery({
    queryKey: ['vehicules'],
    queryFn: () => getVehicules(),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
  });

  const { data: otdData } = useQuery({
    queryKey: ['kpis-otd'],
    queryFn: () => getOtd(),
  });

  const { isPolling, isComplete, result: optimResult } = useOptimisationPolling(tacheId);

  const launchMutation = useMutation({
    mutationFn: () => {
      if (!warehouses || warehouses.length === 0) {
        throw new Error('Aucun entrepôt disponible');
      }
      const today = new Date().toISOString().split('T')[0];
      const selectedWarehouseId = warehouses[0].id;

      // Filtrer les ressources par entrepôt pour éviter l'optimisation multi-entrepôts
      return lancerOptimisation({
        date: today,
        warehouse_id: selectedWarehouseId,
        vehicule_ids: vehicules?.filter((v) => v.statut === 'DISPONIBLE' && v.warehouse_id === selectedWarehouseId).map((v) => v.id) || [],
        commande_ids:
          commandes?.filter((c) => c.statut === 'EN_ATTENTE' && c.date_livraison === today && c.warehouse_id === selectedWarehouseId).map((c) => c.id) || [],
      });
    },
    onSuccess: (data) => {
      setTacheId(data.tache_id);
      toast.success('Optimisation lancée');
    },
    onError: () => toast.error("Erreur lors du lancement de l'optimisation"),
  });

  // Construire les données de carte à partir des tournées actives d'aujourd'hui
  const markers: MapMarker[] = [];
  const routes: MapRoute[] = [];
  const today = new Date().toISOString().split('T')[0];

  tournees
    ?.filter((t) =>
      // Seulement les tournées d'aujourd'hui
      t.date === today &&
      // Seulement les tournées actives (pas terminées)
      (t.statut === 'PLANIFIEE' || t.statut === 'EN_COURS')
    )
    .forEach((t, i) => {
      if (t.stops && t.stops.length > 0) {
        const points: [number, number][] = [];
        t.stops.forEach((stop) => {
          markers.push({
            lat: stop.lat,
            lon: stop.lon,
            statut: t.statut,
            popup: `Commande #${stop.commande_id} — ${t.statut}`,
          });
          points.push([stop.lat, stop.lon]);
        });
        routes.push({ points, color: ROUTE_COLORS[i % ROUTE_COLORS.length] });
      }
    });

  const totalCommandes = commandes?.length ?? 0;
  const tourneesActives = tournees?.filter((t) => t.date === today && t.statut === 'EN_COURS').length ?? 0;
  const vehiculesDisponibles = vehicules?.filter((v) => v.statut === 'DISPONIBLE').length ?? 0;
  const latestOtd = otdData && otdData.length > 0 ? otdData[otdData.length - 1].taux : 0;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500">Vue d'ensemble des opérations</p>
        </div>
        <button
          onClick={() => launchMutation.mutate()}
          disabled={launchMutation.isPending || isPolling}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {isPolling ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Optimisation en cours...
            </span>
          ) : (
            "Lancer l'optimisation"
          )}
        </button>
      </div>

      {/* Cartes KPI */}
      {loadingCommandes ? (
        <LoadingSkeleton type="card" />
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total commandes"
            value={totalCommandes}
            color="text-blue-600"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <KpiCard
            title="Tournées actives"
            value={tourneesActives}
            color="text-green-600"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <KpiCard
            title="OTD %"
            value={`${latestOtd.toFixed(1)}%`}
            color="text-amber-600"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <KpiCard
            title="Véhicules disponibles"
            value={vehiculesDisponibles}
            color="text-purple-600"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            }
          />
        </div>
      )}

      {/* Bannière de résultat d'optimisation */}
      {isComplete && optimResult && (
        <div className="mb-8 rounded-xl border border-green-200 bg-green-50 p-4">
          <h3 className="font-medium text-green-800">Optimisation terminée</h3>
          <p className="text-sm text-green-700">
            Distance totale : {optimResult.distance_totale.toFixed(1)} km — Véhicules utilisés :{' '}
            {optimResult.nb_vehicules_utilises} — Non servies : {optimResult.nb_commandes_non_servies}
          </p>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tableau des commandes */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Commandes récentes</h2>
          </div>
          {loadingCommandes ? (
            <div className="p-5"><LoadingSkeleton rows={5} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Expéditeur ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {commandes?.slice(0, 8).map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/commandes/${c.id}`)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">#{c.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.expediteur_id}</td>
                      <td className="px-4 py-3"><StatusBadge statut={c.statut} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tournées actives */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Tournées actives</h2>
          </div>
          {loadingTournees ? (
            <div className="p-5"><LoadingSkeleton rows={4} /></div>
          ) : (
            <div className="divide-y divide-gray-200">
              {tournees?.filter((t) => ['EN_COURS', 'PLANIFIEE'].includes(t.statut)).slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/tournees/${t.id}`)}
                  className="cursor-pointer px-5 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Chauffeur #{t.chauffeur_id}</p>
                      <p className="text-xs text-gray-500">Véhicule #{t.vehicule_id} — {t.stops?.length ?? 0} arrêts</p>
                    </div>
                    <StatusBadge statut={t.statut} />
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${t.progression}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Carte */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Carte des tournées actives</h2>
          <div className="flex items-center gap-2">
            {markers.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {markers.length} arrêt{markers.length > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs text-gray-500">Aujourd'hui • {today}</span>
          </div>
        </div>
        <MapView
          markers={markers}
          routes={routes}
          center={[21, -11]}  // Centre de la Mauritanie
          zoom={6}
          className="h-96"
        />
      </div>
    </div>
  );
}
