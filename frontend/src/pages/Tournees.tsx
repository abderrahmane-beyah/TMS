import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getTournees, getTournee, updateTournee, type Tournee } from '../api/tournees';
import { getChauffeurs } from '../api/chauffeurs';
import { getVehicules } from '../api/vehicules';
import { getCommandes } from '../api/commandes';
import { getWarehouses } from '../api/warehouses';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { formatKm } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function Tournees() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingTournee, setEditingTournee] = useState<Tournee | null>(null);

  // Filtres
  const [statutFilter, setStatutFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const { data: tournees, isLoading } = useQuery({
    queryKey: ['tournees'],
    queryFn: () => getTournees(),
  });

  const { data: chauffeurs } = useQuery({
    queryKey: ['chauffeurs'],
    queryFn: getChauffeurs,
  });

  const { data: vehicules } = useQuery({
    queryKey: ['vehicules'],
    queryFn: getVehicules,
  });

  const { data: commandes } = useQuery({
    queryKey: ['commandes'],
    queryFn: () => getCommandes({}),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { chauffeur_id?: number; vehicule_id?: number } }) =>
      updateTournee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournees'] });
      setEditingTournee(null);
      toast.success('Tournée modifiée');
    },
    onError: () => toast.error('Erreur lors de la modification'),
  });

  if (isLoading) return <LoadingSkeleton type="card" />;

  // Appliquer les filtres
  const filteredTournees = tournees?.filter(t => {
    if (statutFilter && t.statut !== statutFilter) return false;
    if (dateFilter && t.date !== dateFilter) return false;
    if (warehouseFilter && t.warehouse_id?.toString() !== warehouseFilter) return false;
    return true;
  }) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tournées</h1>
        <p className="text-sm text-gray-500">Toutes les tournées planifiées</p>
      </div>

      {/* Filtres */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">Statut</label>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="PLANIFIEE">Planifiée</option>
            <option value="EN_COURS">En cours</option>
            <option value="TERMINEE">Terminée</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">Entrepôt</label>
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous les entrepôts</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nom} - {w.ville}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!filteredTournees || filteredTournees.length === 0 ? (
        <EmptyState message="Aucune tournée trouvée" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTournees.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Tournée #{t.id}</h3>
                <div className="flex items-center gap-2">
                  <StatusBadge statut={t.statut} />
                  {t.statut === 'PLANIFIEE' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTournee(t);
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              </div>

              <div
                onClick={() => navigate(`/tournees/${t.id}`)}
                className="cursor-pointer"
              >
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Date de livraison</dt>
                    <dd className="font-medium text-gray-900">{t.date}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Chauffeur</dt>
                    <dd className="font-medium text-gray-900">
                      {chauffeurs?.find(c => c.id === t.chauffeur_id)?.nom || `#${t.chauffeur_id}`}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Véhicule</dt>
                    <dd className="text-gray-900">
                      {vehicules?.find(v => v.id === t.vehicule_id)?.immatriculation || `#${t.vehicule_id}`}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Arrêts</dt>
                    <dd className="text-gray-900">{t.stops?.length ?? 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Distance</dt>
                    <dd className="text-gray-900">{t.distance_totale ? formatKm(t.distance_totale) : 'N/A'}</dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-gray-500">
                    <span>Progression</span>
                    <span>{t.progression}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${t.progression}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale d'édition */}
      {editingTournee && (
        <EditTourneeModal
          tournee={editingTournee}
          chauffeurs={chauffeurs || []}
          vehicules={vehicules || []}
          commandes={commandes || []}
          warehouses={warehouses || []}
          onSave={(data) => updateMutation.mutate({ id: editingTournee.id, data })}
          onCancel={() => setEditingTournee(null)}
          loading={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditTourneeModal({
  tournee,
  chauffeurs,
  vehicules,
  commandes,
  warehouses,
  onSave,
  onCancel,
  loading,
}: {
  tournee: Tournee;
  chauffeurs: any[];
  vehicules: any[];
  commandes: any[];
  warehouses: any[];
  onSave: (data: { chauffeur_id?: number; vehicule_id?: number }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [chauffeurId, setChauffeurId] = useState(tournee.chauffeur_id);
  const [vehiculeId, setVehiculeId] = useState(tournee.vehicule_id);
  const [fullTournee, setFullTournee] = useState<Tournee | null>(null);

  // Récupérer les détails complets de la tournée avec ses arrêts
  useEffect(() => {
    getTournee(tournee.id).then(setFullTournee);
  }, [tournee.id]);

  // Récupérer l'entrepôt de la tournée
  const tourneeWarehouse = tournee.warehouse_id;

  // Calculer le poids et le volume totaux nécessaires pour cette tournée
  const commandeIds = fullTournee?.stops?.map(s => s.commande_id) || [];
  const tourneeCommandes = commandes.filter(c => commandeIds.includes(c.id));
  const totalPoids = tourneeCommandes.reduce((sum, c) => sum + c.poids, 0);
  const totalVolume = tourneeCommandes.reduce((sum, c) => sum + c.volume, 0);

  // Filtrer les chauffeurs : même entrepôt et disponibilité
  const filteredChauffeurs = chauffeurs.filter(c =>
    c.statut === 'DISPONIBLE' &&
    (!tourneeWarehouse || c.warehouse_id === tourneeWarehouse)
  );

  // Filtrer les véhicules : même entrepôt, disponibles, capacité >= besoin
  const filteredVehicules = vehicules.filter(v =>
    v.statut === 'DISPONIBLE' &&
    (!tourneeWarehouse || v.warehouse_id === tourneeWarehouse) &&
    v.capacite_poids >= totalPoids &&
    v.capacite_volume >= totalVolume
  );

  const handleSave = () => {
    onSave({
      chauffeur_id: chauffeurId,
      vehicule_id: vehiculeId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Modifier Tournée #{tournee.id}
        </h2>

        {/* Informations des besoins de la tournée */}
        <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm">
          <p className="font-medium text-blue-900">Requis pour cette tournée:</p>
          <p className="text-blue-700">
            Entrepôt: {warehouses.find(w => w.id === tourneeWarehouse)?.nom || 'N/A'}
          </p>
          <p className="text-blue-700">
            Capacité: {totalPoids.toFixed(1)}kg, {totalVolume.toFixed(1)}m³
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Chauffeur ({filteredChauffeurs.length} disponible{filteredChauffeurs.length !== 1 ? 's' : ''})
            </label>
            <select
              value={chauffeurId}
              onChange={(e) => setChauffeurId(parseInt(e.target.value))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {filteredChauffeurs.length === 0 ? (
                <option value="">Aucun chauffeur disponible</option>
              ) : (
                filteredChauffeurs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} - {c.ville || 'N/A'}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Véhicule ({filteredVehicules.length} disponible{filteredVehicules.length !== 1 ? 's' : ''})
            </label>
            <select
              value={vehiculeId}
              onChange={(e) => setVehiculeId(parseInt(e.target.value))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {filteredVehicules.length === 0 ? (
                <option value="">Aucun véhicule disponible</option>
              ) : (
                filteredVehicules.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.immatriculation} - {v.ville || 'N/A'} ({v.capacite_poids}kg, {v.capacite_volume}m³)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
