import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCommandes, deleteCommande, updateCommande } from '../api/commandes';
import { getWarehouses } from '../api/warehouses';
import type { Commande } from '../api/commandes';
import DataTable, { type Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { useHybridGeocoding as useGeocoding } from '../hooks/useHybridGeocoding';
import toast from 'react-hot-toast';

export default function Commandes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const [statutFilter, setStatutFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnserved, setShowUnserved] = useState(false);

  // État de la boîte de confirmation
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);

  // État de la modale d'édition
  const [editingCommande, setEditingCommande] = useState<Commande | null>(null);
  const [editForm, setEditForm] = useState({
    warehouse_id: '',
    adresse_livraison: '',
    lat_livraison: 0,
    lon_livraison: 0,
    poids: '',
    volume: '',
    type_vehicule_requis: '',
    date_livraison: '',
    heure_ouverture: '',
    heure_fermeture: '',
  });
  const [geocodeStatus, setGeocodeStatus] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    text: string;
  }>({ status: 'idle', text: '' });

  const ITEMS_PER_PAGE = 100; // Augmenté pour afficher plus de commandes

  const { data, isLoading } = useQuery({
    queryKey: ['commandes', { page, statut: statutFilter, warehouse_id: warehouseFilter }],
    queryFn: () => getCommandes({
      skip: (page - 1) * ITEMS_PER_PAGE,
      limit: ITEMS_PER_PAGE,
      statut: statutFilter || undefined,
      warehouse_id: warehouseFilter ? parseInt(warehouseFilter) : undefined
    }),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  // Récupérer le compte total des commandes NON_AFFECTEE (sans filtre)
  const { data: unservedCommandes } = useQuery({
    queryKey: ['commandes-non-affectees-count'],
    queryFn: () => getCommandes({ statut: 'NON_AFFECTEE', limit: 1000 }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => deleteCommande(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      setConfirmCancel(null);
      toast.success('Commande annulée');
    },
    onError: () => toast.error("Erreur lors de l'annulation"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Commande> }) =>
      updateCommande(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      setEditingCommande(null);
      toast.success('Commande modifiée');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || "Erreur lors de la modification";
      toast.error(message);
    },
  });

  const { geocode, loading: geocoding } = useGeocoding();

  const handleStartEdit = (commande: Commande) => {
    setEditingCommande(commande);
    setEditForm({
      warehouse_id: commande.warehouse_id?.toString() || '',
      adresse_livraison: commande.adresse_livraison,
      lat_livraison: commande.lat_livraison,
      lon_livraison: commande.lon_livraison,
      poids: commande.poids.toString(),
      volume: commande.volume.toString(),
      type_vehicule_requis: commande.type_vehicule_requis || '',
      date_livraison: commande.date_livraison,
      heure_ouverture: commande.heure_ouverture,
      heure_fermeture: commande.heure_fermeture,
    });
    setGeocodeStatus({ status: 'success', text: `${commande.lat_livraison.toFixed(4)}, ${commande.lon_livraison.toFixed(4)}` });
  };

  const handleGeocodeDelivery = useCallback(async () => {
    if (editForm.adresse_livraison.length < 5) return;
    setGeocodeStatus({ status: 'loading', text: 'Résolution...' });
    const result = await geocode(editForm.adresse_livraison);
    if (result) {
      setEditForm((f) => ({ ...f, lat_livraison: result.lat, lon_livraison: result.lon }));
      setGeocodeStatus({ status: 'success', text: `${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}` });
    } else {
      setEditForm((f) => ({ ...f, lat_livraison: 0, lon_livraison: 0 }));
      setGeocodeStatus({ status: 'error', text: 'Adresse non trouvée' });
    }
  }, [editForm.adresse_livraison, geocode]);

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommande) return;

    // Validation
    if (!editForm.warehouse_id || !editForm.adresse_livraison.trim() || !editForm.lat_livraison ||
        !editForm.poids || !editForm.volume || !editForm.date_livraison ||
        !editForm.heure_ouverture || !editForm.heure_fermeture) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (editForm.heure_ouverture >= editForm.heure_fermeture) {
      toast.error("L'heure de fermeture doit être après l'ouverture");
      return;
    }

    updateMutation.mutate({
      id: editingCommande.id,
      data: {
        warehouse_id: parseInt(editForm.warehouse_id),
        adresse_livraison: editForm.adresse_livraison,
        lat_livraison: editForm.lat_livraison,
        lon_livraison: editForm.lon_livraison,
        poids: parseFloat(editForm.poids),
        volume: parseFloat(editForm.volume),
        type_vehicule_requis: editForm.type_vehicule_requis ? (editForm.type_vehicule_requis as 'NORMAL' | 'REFRIGERE' | 'CONGELATEUR') : undefined,
        date_livraison: editForm.date_livraison,
        heure_ouverture: editForm.heure_ouverture,
        heure_fermeture: editForm.heure_fermeture,
      },
    });
  };

  // Filtrer les données localement par recherche et statut "non affectées"
  // Si showUnserved est actif, utiliser unservedCommandes au lieu de data
  const sourceData = showUnserved ? unservedCommandes : data;

  const filteredData = sourceData?.filter((cmd) => {
    // Filtre de recherche
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cmd.id.toString().includes(search) ||
      cmd.adresse_livraison.toLowerCase().includes(search) ||
      cmd.date_livraison.includes(search) ||
      (cmd.expediteur_nom && cmd.expediteur_nom.toLowerCase().includes(search))
    );
  });

  const unservedCount = unservedCommandes?.length || 0;

  const columns: Column<Commande>[] = [
    { key: 'id', header: 'ID', render: (row) => <span className="font-medium">#{row.id}</span> },
    {
      key: 'expediteur',
      header: 'Expéditeur',
      render: (row) => <span className="text-sm">{row.expediteur_nom || `Exp. #${row.expediteur_id}`}</span>
    },
    {
      key: 'warehouse',
      header: 'Entrepôt',
      render: (row) => {
        const warehouse = warehouses?.find(w => w.id === row.warehouse_id);
        return warehouse ? <span className="text-sm">{warehouse.nom}</span> : <span className="text-gray-400">-</span>;
      }
    },
    { key: 'adresse_livraison', header: 'Livraison', render: (row) => <span className="max-w-[200px] truncate block">{row.adresse_livraison}</span> },
    { key: 'poids', header: 'Poids', render: (row) => `${row.poids} kg` },
    {
      key: 'fenetre',
      header: 'Fenêtre de temps',
      render: (row) => `${row.date_livraison} ${row.heure_ouverture} — ${row.heure_fermeture}`,
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (row) => <StatusBadge statut={row.statut} />,
    },
    ...(role === 'Expediteur' || role === 'Dispatcheur' || role === 'Administrateur'
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (row: Commande) => (
              <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                {/* Bouton Modifier : expéditeur sur ses commandes, admin sur toutes (EN_ATTENTE, AFFECTEE ou NON_AFFECTEE) */}
                {(row.statut === 'EN_ATTENTE' || row.statut === 'AFFECTEE' || row.statut === 'NON_AFFECTEE') && (role === 'Expediteur' || role === 'Administrateur') && (
                  <button
                    onClick={() => handleStartEdit(row)}
                    className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                  >
                    Modifier
                  </button>
                )}
                {/* Bouton Annuler : dispatcheur/admin uniquement */}
                {row.statut === 'EN_ATTENTE' && (role === 'Dispatcheur' || role === 'Administrateur') && (
                  <button
                    onClick={() => setConfirmCancel(row.id)}
                    className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                  >
                    Annuler
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="text-sm text-gray-500">Gestion des commandes de transport</p>
        </div>
        {(role === 'Expediteur' || role === 'Administrateur') && (
          <button
            onClick={() => navigate('/commandes/nouvelle')}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nouvelle commande
          </button>
        )}
      </div>

      {/* Filtres et recherche */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par ID, adresse, expéditeur ou date..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={statutFilter}
            onChange={(e) => { setStatutFilter(e.target.value); setPage(1); setShowUnserved(false); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="AFFECTEE">Affectée</option>
            <option value="EN_COURS">En cours</option>
            <option value="LIVREE">Livrée</option>
            <option value="NON_AFFECTEE">Non affectée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
          <select
            value={warehouseFilter}
            onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous les entrepôts</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nom} - {w.ville}
              </option>
            ))}
          </select>
        </div>

        {/* Bouton pour afficher les commandes non servies par l'optimisation */}
        {(role === 'Dispatcheur' || role === 'Administrateur' || role === 'Expediteur') && (
          <button
            onClick={() => {
              setShowUnserved(!showUnserved);
              if (!showUnserved) {
                setStatutFilter('');
              }
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              showUnserved
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'border border-orange-600 text-orange-600 hover:bg-orange-50'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {showUnserved ? 'Afficher toutes les commandes' : `Non affectées par l'optimisation (${unservedCount})`}
          </button>
        )}

        {/* Message informatif quand le filtre est actif */}
        {showUnserved && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-orange-900">
                  Commandes non affectées par l'optimisation
                </p>
                <p className="mt-1 text-xs text-orange-700">
                  Ces commandes n'ont pas pu être assignées à un véhicule lors de la dernière optimisation
                  (capacité insuffisante, fenêtres de temps incompatibles, ou type de véhicule requis indisponible).
                  Vous pouvez les modifier et relancer l'optimisation.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <DataTable<Commande>
        columns={columns}
        data={filteredData ?? []}
        loading={isLoading}
        emptyMessage="Aucune commande trouvée"
        onRowClick={(row) => navigate(`/commandes/${row.id}`)}
      />

      <ConfirmDialog
        open={confirmCancel !== null}
        title="Annuler la commande"
        message="Êtes-vous sûr de vouloir annuler cette commande ? Cette action est irréversible."
        confirmLabel="Annuler la commande"
        onConfirm={() => confirmCancel && cancelMutation.mutate(confirmCancel)}
        onCancel={() => setConfirmCancel(null)}
        loading={cancelMutation.isPending}
      />

      {/* Modale d'édition */}
      {editingCommande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Modifier la commande #{editingCommande.id}
            </h2>

            {editingCommande.statut === 'AFFECTEE' && (
              <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 p-3">
                <p className="text-sm font-medium text-orange-900">Attention</p>
                <p className="text-sm text-orange-700">
                  Cette commande est déjà affectée à une tournée. La modifier la retirera de la tournée
                  et la remettra en attente pour être ré-optimisée.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="space-y-4" noValidate>
              {/* Sélection de l'entrepôt */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Entrepôt d'enlèvement
                </label>
                <select
                  value={editForm.warehouse_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, warehouse_id: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">Sélectionner un entrepôt...</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nom} - {w.ville}
                    </option>
                  ))}
                </select>
              </div>

              {/* Adresse de livraison */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Adresse de livraison
                </label>
                <input
                  type="text"
                  value={editForm.adresse_livraison}
                  onChange={(e) => {
                    setEditForm((f) => ({ ...f, adresse_livraison: e.target.value, lat_livraison: 0, lon_livraison: 0 }));
                    setGeocodeStatus({ status: 'idle', text: '' });
                  }}
                  onBlur={handleGeocodeDelivery}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Rue du Port, Nouadhibou"
                  required
                />
                {geocodeStatus.text && (
                  <p
                    className={`mt-1 flex items-center gap-1 text-xs ${
                      geocodeStatus.status === 'loading'
                        ? 'text-gray-500'
                        : geocodeStatus.status === 'success'
                        ? 'text-green-600'
                        : 'text-red-500'
                    }`}
                  >
                    {geocodeStatus.status === 'loading' && (
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    )}
                    {geocodeStatus.text}
                  </p>
                )}
              </div>

              {/* Poids + Volume + Type de véhicule */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Poids (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editForm.poids}
                    onChange={(e) => setEditForm((f) => ({ ...f, poids: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Volume (m³)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.volume}
                    onChange={(e) => setEditForm((f) => ({ ...f, volume: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Type de véhicule
                  </label>
                  <select
                    value={editForm.type_vehicule_requis}
                    onChange={(e) => setEditForm((f) => ({ ...f, type_vehicule_requis: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Tous types</option>
                    <option value="NORMAL"> Normal</option>
                    <option value="REFRIGERE"> Réfrigéré</option>
                    <option value="CONGELATEUR"> Congélateur</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Laisser vide pour accepter tout type</p>
                </div>
              </div>

              {/* Date de livraison + Fenêtre horaire */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Date de livraison
                  </label>
                  <input
                    type="date"
                    value={editForm.date_livraison}
                    onChange={(e) => setEditForm((f) => ({ ...f, date_livraison: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Heure d'ouverture
                  </label>
                  <input
                    type="time"
                    value={editForm.heure_ouverture}
                    onChange={(e) => setEditForm((f) => ({ ...f, heure_ouverture: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Heure de fermeture
                  </label>
                  <input
                    type="time"
                    value={editForm.heure_fermeture}
                    onChange={(e) => setEditForm((f) => ({ ...f, heure_fermeture: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={updateMutation.isPending || geocoding}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {updateMutation.isPending ? 'Modification...' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCommande(null)}
                  className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
