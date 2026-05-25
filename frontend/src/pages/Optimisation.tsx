import { useState, useEffect, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVehicules } from '../api/vehicules';
import { getCommandes } from '../api/commandes';
import { getWarehouses } from '../api/warehouses';
import { lancerOptimisation, getOptimisationHistory } from '../api/optimisation';
import { useOptimisationPolling } from '../hooks/useOptimisationPolling';
import LoadingSkeleton from '../components/LoadingSkeleton';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime } from '../utils/formatters';
import toast from 'react-hot-toast';

export function formatDistanceKm(distance: number | null | undefined): string {
  return distance != null ? `${distance.toFixed(1)} km` : 'N/A';
}

export function getSafeCount(value: number | null | undefined): number {
  return value ?? 0;
}

export function getTourneesDepuisResultat(result: { resultat_json?: any }): any[] {
  return result.resultat_json?.tournees ?? [];
}

export function getCommandesNonServiesDepuisResultat(result: { resultat_json?: any }): any[] {
  return result.resultat_json?.commandes_non_servies ?? [];
}

export default function Optimisation() {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState<string>('');

  const [date, setDate] = useState('');
  const [selectedVehicules, setSelectedVehicules] = useState<number[]>([]);
  const [selectedCommandes, setSelectedCommandes] = useState<number[]>([]);
  const [searchCommande, setSearchCommande] = useState('');

  const [tacheId, setTacheId] = useState<number | null>(null);

  const { data: warehouses, isLoading: loadingW } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const { data: vehicules, isLoading: loadingV } = useQuery({
    queryKey: ['vehicules'],
    queryFn: getVehicules,
  });

  // Récupérer EN_ATTENTE, AFFECTEE et NON_AFFECTEE pour ré-optimisation avant démarrage
  // Le backend supprime uniquement les tournées PLANIFIEE (garde EN_COURS/TERMINEE intactes)
  const { data: commandesEnAttente, isLoading: loadingAttente } = useQuery({
    queryKey: ['commandes', { statut: 'EN_ATTENTE', warehouse_id: warehouseId ? parseInt(warehouseId) : undefined }],
    queryFn: () => getCommandes({
      statut: 'EN_ATTENTE',
      warehouse_id: warehouseId ? parseInt(warehouseId) : undefined
    }),
    refetchInterval: 30000,
  });

  const { data: commandesAffectees, isLoading: loadingAffectees } = useQuery({
    queryKey: ['commandes', { statut: 'AFFECTEE', warehouse_id: warehouseId ? parseInt(warehouseId) : undefined }],
    queryFn: () => getCommandes({
      statut: 'AFFECTEE',
      warehouse_id: warehouseId ? parseInt(warehouseId) : undefined
    }),
    refetchInterval: 30000,
  });

  const { data: commandesNonAffectees, isLoading: loadingNonAffectees } = useQuery({
    queryKey: ['commandes', { statut: 'NON_AFFECTEE', warehouse_id: warehouseId ? parseInt(warehouseId) : undefined }],
    queryFn: () => getCommandes({
      statut: 'NON_AFFECTEE',
      warehouse_id: warehouseId ? parseInt(warehouseId) : undefined
    }),
    refetchInterval: 30000,
  });

  // Combiner les trois listes
  const commandes = [
    ...(commandesEnAttente || []),
    ...(commandesAffectees || []),
    ...(commandesNonAffectees || [])
  ];
  const loadingC = loadingAttente || loadingAffectees || loadingNonAffectees;

  const polling = useOptimisationPolling(tacheId);

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['optimisation-history'],
    queryFn: getOptimisationHistory,
  });

  // Rafraîchir l'historique lorsqu'une exécution se termine
  useEffect(() => {
    if (polling.isComplete) {
      queryClient.invalidateQueries({ queryKey: ['optimisation-history'] });
    }
  }, [polling.isComplete, queryClient]);

  const launchMutation = useMutation({
    mutationFn: lancerOptimisation,
    onSuccess: (data) => {
      setTacheId(data.tache_id);
      toast.success('Optimisation lancée');
    },
    onError: () => toast.error("Erreur lors du lancement"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast.error('Sélectionnez la date de livraison');
      return;
    }
    if (selectedVehicules.length === 0) {
      toast.error('Sélectionnez au moins un véhicule');
      return;
    }
    if (selectedCommandes.length === 0) {
      toast.error('Sélectionnez au moins une commande');
      return;
    }

    // Regrouper les ressources sélectionnées par entrepôt pour validation
    const selectedVehiculesData = vehicules?.filter(v => selectedVehicules.includes(v.id));
    const selectedCommandesData = commandes?.filter(c => selectedCommandes.includes(c.id));

    const warehouseIds = new Set([
      ...selectedVehiculesData?.map(v => v.warehouse_id).filter(Boolean) || [],
      ...selectedCommandesData?.map(c => c.warehouse_id).filter(Boolean) || []
    ]);

    if (warehouseIds.size === 0) {
      toast.error('Les ressources sélectionnées doivent être assignées à un entrepôt');
      return;
    }

    if (warehouseIds.size > 1) {
      toast.error('Tous les véhicules et commandes doivent appartenir au même entrepôt');
      return;
    }

    // Vérifier que toutes les commandes ont la même date de livraison que la date d'optimisation
    const invalidDateCommandes = selectedCommandesData?.filter(c => c.date_livraison !== date);
    if (invalidDateCommandes && invalidDateCommandes.length > 0) {
      toast.error(
        `Toutes les commandes doivent avoir la date de livraison ${date}. ` +
        `${invalidDateCommandes.length} commande(s) ont des dates différentes.`
      );
      return;
    }

    const warehouse_id = Array.from(warehouseIds)[0] as number;

    launchMutation.mutate({
      warehouse_id,
      date,
      vehicule_ids: selectedVehicules,
      commande_ids: selectedCommandes,
    });
  };

  const toggleVehicule = (id: number) =>
    setSelectedVehicules((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );

  const toggleCommande = (id: number) =>
    setSelectedCommandes((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  const selectAllVehicules = () => {
    const availableVehicules = vehicules?.filter((v) =>
      v.statut === 'DISPONIBLE' &&
      (!warehouseId || v.warehouse_id === parseInt(warehouseId))
    ).map((v) => v.id) || [];
    setSelectedVehicules(availableVehicules);
  };

  const deselectAllVehicules = () => {
    setSelectedVehicules([]);
  };

  const selectAllCommandes = () => {
    const filteredCommandes = commandes?.filter((c) =>
      (searchCommande === '' ||
        c.adresse_livraison.toLowerCase().includes(searchCommande.toLowerCase()) ||
        c.id.toString().includes(searchCommande)) &&
      (!date || c.date_livraison === date) &&
      (!warehouseId || c.warehouse_id === parseInt(warehouseId))
    ).map((c) => c.id) || [];
    setSelectedCommandes(filteredCommandes);
  };

  const deselectAllCommandes = () => {
    setSelectedCommandes([]);
  };

  const isRunning = polling.isPolling;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Optimisation</h1>
        <p className="text-sm text-gray-500">Lancer l'optimisation des tournées avec OR-Tools</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Filtrer par entrepôt <span className="text-xs font-normal text-gray-500">(optionnel)</span>
            </label>
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setSelectedVehicules([]);
                setSelectedCommandes([]);
              }}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tous les entrepôts</option>
              {warehouses?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nom} - {w.ville}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Date de livraison</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSelectedCommandes([]); // Réinitialiser la sélection lors du changement de date
              }}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Sélecteur de véhicules */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Véhicules disponibles ({selectedVehicules.length} sélectionnés)
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllVehicules}
                className="text-xs text-blue-600 hover:underline"
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                onClick={deselectAllVehicules}
                className="text-xs text-gray-600 hover:underline"
              >
                Tout désélectionner
              </button>
            </div>
          </div>
          {loadingV ? (
            <LoadingSkeleton rows={2} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {vehicules
                ?.filter((v) =>
                  v.statut === 'DISPONIBLE' &&
                  (!warehouseId || v.warehouse_id === parseInt(warehouseId))
                )
                .map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleVehicule(v.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedVehicules.includes(v.id)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {v.immatriculation}
                    {!warehouseId && v.warehouse_id && warehouses?.find(w => w.id === v.warehouse_id) && (
                      <span className="ml-1 text-xs text-gray-500">
                        ({warehouses.find(w => w.id === v.warehouse_id)?.ville})
                      </span>
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Sélecteur de commandes */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700">
                Commandes disponibles ({selectedCommandes.length} sélectionnées)
              </h3>
              <p className="text-xs text-gray-500">
                Nouvelles + déjà affectées (tournées non démarrées) + non servies
                {date && ` • Date: ${date}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllCommandes}
                className="text-xs text-blue-600 hover:underline"
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                onClick={deselectAllCommandes}
                className="text-xs text-gray-600 hover:underline"
              >
                Tout désélectionner
              </button>
            </div>
          </div>
          <div className="mb-2">
            <input
              type="text"
              placeholder="Rechercher par ID ou adresse..."
              value={searchCommande}
              onChange={(e) => setSearchCommande(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {loadingC ? (
            <LoadingSkeleton rows={2} />
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
              {commandes
                ?.filter((c) =>
                  (searchCommande === '' ||
                    c.adresse_livraison.toLowerCase().includes(searchCommande.toLowerCase()) ||
                    c.id.toString().includes(searchCommande)) &&
                  (!date || c.date_livraison === date) &&
                  (!warehouseId || c.warehouse_id === parseInt(warehouseId))
                )
                .map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 hover:bg-gray-50 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCommandes.includes(c.id)}
                      onChange={() => toggleCommande(c.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="flex-1 text-sm text-gray-900">
                      #{c.id} — {c.adresse_livraison} ({c.poids} kg)
                      {c.statut === 'NON_AFFECTEE' && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Non affectée
                        </span>
                      )}
                      {!warehouseId && c.warehouse_id && warehouses?.find(w => w.id === c.warehouse_id) && (
                        <span className="ml-2 text-xs text-gray-500">
                          [{warehouses.find(w => w.id === c.warehouse_id)?.nom}]
                        </span>
                      )}
                    </span>
                  </label>
                ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={launchMutation.isPending || isRunning}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isRunning ? (
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

        {/* Barre de progression */}
        {isRunning && polling.statut && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Progression</span>
              <span className="font-semibold text-blue-600">{polling.statut.progression}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${polling.statut.progression}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {polling.statut.progression <= 10 && "Démarrage de l'optimisation..."}
              {polling.statut.progression > 10 && polling.statut.progression <= 30 && "Chargement des données..."}
              {polling.statut.progression > 30 && polling.statut.progression <= 40 && "Préparation du solveur..."}
              {polling.statut.progression > 40 && polling.statut.progression < 70 && "Calcul des tournées optimales..."}
              {polling.statut.progression >= 70 && polling.statut.progression < 100 && "Sauvegarde des résultats..."}
              {polling.statut.progression === 100 && "Terminé !"}
            </p>
          </div>
        )}
      </form>

      {/* Résultats */}
      {polling.result && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900">Résultats de l'optimisation</h2>
          <ResultPanel title="OR-Tools" result={polling.result} />
        </div>
      )}

      {/* Historique */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Historique des optimisations</h2>
        </div>
        {loadingHistory ? (
          <div className="p-5"><LoadingSkeleton rows={4} /></div>
        ) : history && history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Algorithme</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Distance</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Véhicules</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Non servies</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Lancée le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{h.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{h.date_execution ? formatDateTime(h.date_execution) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{h.algorithme}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        h.statut === 'TERMINEE' ? 'bg-green-100 text-green-800' :
                        h.statut === 'EN_COURS' ? 'bg-blue-100 text-blue-800' :
                        h.statut === 'ERREUR' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {h.statut === 'TERMINEE' ? 'Terminée' :
                         h.statut === 'EN_COURS' ? 'En cours' :
                         h.statut === 'ERREUR' ? 'Erreur' :
                         h.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {h.distance_totale ? `${h.distance_totale.toFixed(1)} km` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {h.nb_vehicules_utilises ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {h.nb_commandes_non_servies ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(h.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-gray-500">Aucune optimisation précédente</p>
        )}
      </div>
    </div>
  );
}

function ResultPanel({ title, result }: { title: string; result: NonNullable<ReturnType<typeof useOptimisationPolling>['result']> }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">{title}</h3>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-xs text-blue-600">Distance</p>
          <p className="text-lg font-bold text-blue-900">{formatDistanceKm(result.distance_totale)}</p>
        </div>
        <div className="rounded-lg bg-green-50 p-3 text-center">
          <p className="text-xs text-green-600">Véhicules</p>
          <p className="text-lg font-bold text-green-900">{getSafeCount(result.nb_vehicules_utilises)}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <p className="text-xs text-red-600">Non servies</p>
          <p className="text-lg font-bold text-red-900">{getSafeCount(result.nb_commandes_non_servies)}</p>
        </div>
      </div>

      {/* Détail des tournées */}
      {getTourneesDepuisResultat(result).length > 0 && (
        <div className="space-y-2">
          {getTourneesDepuisResultat(result).map((t, i) => (
            <div key={i} className="rounded-lg border border-gray-100 p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">Véhicule #{t.vehicule_id}</span>
                <span className="text-gray-500">{t.distance?.toFixed(1) ?? 0} km — {t.stops?.length ?? 0} arrêts</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Commandes non servies */}
      {getCommandesNonServiesDepuisResultat(result).length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-medium uppercase text-red-600">Non servies</h4>
          {getCommandesNonServiesDepuisResultat(result).map((c) => (
            <p key={c.commande_id} className="text-xs text-red-700">
              #{c.commande_id} — {c.raison}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
