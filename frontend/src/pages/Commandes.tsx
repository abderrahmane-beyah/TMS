import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCommandes, updateCommandeStatut, deleteCommande } from '../api/commandes';
import { getVehicules } from '../api/vehicules';
import { getChauffeurs } from '../api/chauffeurs';
import type { Commande } from '../api/commandes';
import DataTable, { type Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Commandes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const [statutFilter, setStatutFilter] = useState('');

  // Confirm dialog state
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);

  // Assignment dropdown state
  const [assignVehicule, setAssignVehicule] = useState<number | null>(null);
  const [assignChauffeur, setAssignChauffeur] = useState<number | null>(null);

  const ITEMS_PER_PAGE = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['commandes', { page, statut: statutFilter }],
    queryFn: () => getCommandes({
      skip: (page - 1) * ITEMS_PER_PAGE,
      limit: ITEMS_PER_PAGE,
      statut: statutFilter || undefined
    }),
  });

  const { data: vehicules } = useQuery({
    queryKey: ['vehicules'],
    queryFn: getVehicules,
    enabled: role === 'Dispatcheur' || role === 'Administrateur',
  });

  const { data: chauffeurs } = useQuery({
    queryKey: ['chauffeurs'],
    queryFn: getChauffeurs,
    enabled: role === 'Dispatcheur' || role === 'Administrateur',
  });

  const updateStatut = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: string }) => updateCommandeStatut(id, statut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Statut mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
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

  const handleAffecterVehicule = (commandeId: number, _vehiculeId: string) => {
    // In a real app this would call a dedicated endpoint; for now we move to AFFECTÉE
    updateStatut.mutate({ id: commandeId, statut: 'AFFECTÉE' });
    setAssignVehicule(null);
  };

  const handleAffecterChauffeur = (commandeId: number, _chauffeurId: string) => {
    updateStatut.mutate({ id: commandeId, statut: 'AFFECTÉE' });
    setAssignChauffeur(null);
  };

  const columns: Column<Commande>[] = [
    { key: 'id', header: 'ID', render: (row) => <span className="font-medium">#{row.id}</span> },
    { key: 'expediteur', header: 'Expediteur' },
    { key: 'adresse_enlevement', header: 'Enlèvement', render: (row) => <span className="max-w-[200px] truncate block">{row.adresse_enlevement}</span> },
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
    ...(role === 'Dispatcheur' || role === 'Administrateur'
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (row: Commande) => (
              <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                {row.statut === 'EN_ATTENTE' && (
                  <>
                    {/* Assign vehicle */}
                    {assignVehicule === row.id ? (
                      <select
                        autoFocus
                        className="rounded border border-blue-300 px-1.5 py-0.5 text-xs"
                        defaultValue=""
                        onChange={(e) => handleAffecterVehicule(row.id, e.target.value)}
                        onBlur={() => setAssignVehicule(null)}
                      >
                        <option value="" disabled>Choisir...</option>
                        {vehicules?.filter((v) => v.statut === 'DISPONIBLE').map((v) => (
                          <option key={v.id} value={v.id}>{v.immatriculation}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setAssignVehicule(row.id)}
                        className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                      >
                        Véhicule
                      </button>
                    )}
                    {/* Assign driver */}
                    {assignChauffeur === row.id ? (
                      <select
                        autoFocus
                        className="rounded border border-green-300 px-1.5 py-0.5 text-xs"
                        defaultValue=""
                        onChange={(e) => handleAffecterChauffeur(row.id, e.target.value)}
                        onBlur={() => setAssignChauffeur(null)}
                      >
                        <option value="" disabled>Choisir...</option>
                        {chauffeurs?.filter((c) => c.statut === 'DISPONIBLE').map((c) => (
                          <option key={c.id} value={c.id}>{c.nom}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setAssignChauffeur(row.id)}
                        className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                      >
                        Chauffeur
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmCancel(row.id)}
                      className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                    >
                      Annuler
                    </button>
                  </>
                )}
                {row.statut === 'AFFECTÉE' && (
                  <button
                    onClick={() => updateStatut.mutate({ id: row.id, statut: 'EN_COURS' })}
                    className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                  >
                    Démarrer
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

      {/* Filters */}
      <div className="mb-6">
        <select
          value={statutFilter}
          onChange={(e) => { setStatutFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Tous les statuts</option>
          <option value="EN_ATTENTE">En attente</option>
          <option value="AFFECTÉE">Affectée</option>
          <option value="EN_COURS">En cours</option>
          <option value="LIVRÉE">Livrée</option>
        </select>
      </div>

      <DataTable<Commande>
        columns={columns}
        data={data ?? []}
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
    </div>
  );
}
