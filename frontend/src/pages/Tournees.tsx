import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getTournees } from '../api/tournees';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { formatKm } from '../utils/formatters';

export default function Tournees() {
  const navigate = useNavigate();

  const { data: tournees, isLoading } = useQuery({
    queryKey: ['tournees'],
    queryFn: () => getTournees(),
  });

  if (isLoading) return <LoadingSkeleton type="card" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tournées</h1>
        <p className="text-sm text-gray-500">Tournées du jour</p>
      </div>

      {!tournees || tournees.length === 0 ? (
        <EmptyState message="Aucune tournée pour aujourd'hui" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournees.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/tournees/${t.id}`)}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Tournée #{t.id}</h3>
                <StatusBadge statut={t.statut} />
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Chauffeur</dt>
                  <dd className="font-medium text-gray-900">#{t.chauffeur_id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Véhicule</dt>
                  <dd className="text-gray-900">#{t.vehicule_id}</dd>
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
          ))}
        </div>
      )}
    </div>
  );
}
