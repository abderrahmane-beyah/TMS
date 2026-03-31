import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnomalies, resoudreAnomalie } from '../api/anomalies';
import type { Anomalie } from '../api/anomalies';
import DataTable, { type Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function Anomalies() {
  const queryClient = useQueryClient();

  const { data: anomalies, isLoading } = useQuery({
    queryKey: ['anomalies'],
    queryFn: getAnomalies,
  });

  const resolveMutation = useMutation({
    mutationFn: resoudreAnomalie,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      toast.success('Anomalie résolue');
    },
    onError: () => toast.error('Erreur lors de la résolution'),
  });

  const columns: Column<Anomalie>[] = [
    { key: 'tournee_id', header: 'Tournée', render: (row) => `#${row.tournee_id}` },
    { key: 'stop_id', header: 'Arrêt', render: (row) => row.stop_id ? `#${row.stop_id}` : '—' },
    { key: 'type', header: 'Type', render: (row) => <span className="font-medium">{row.type}</span> },
    { key: 'description', header: 'Description' },
    { key: 'date', header: 'Date', render: (row) => formatDateTime(row.date) },
    { key: 'statut', header: 'Statut', render: (row) => <StatusBadge statut={row.statut} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {row.statut !== 'RÉSOLUE' && (
            <button
              onClick={() => resolveMutation.mutate(row.id)}
              disabled={resolveMutation.isPending}
              className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
            >
              Résoudre
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Anomalies</h1>
        <p className="text-sm text-gray-500">Gestion des anomalies de livraison</p>
      </div>

      <DataTable
        columns={columns}
        data={(anomalies ?? []) as unknown as Record<string, unknown>[]}
        loading={isLoading}
        emptyMessage="Aucune anomalie en cours"
      />
    </div>
  );
}
