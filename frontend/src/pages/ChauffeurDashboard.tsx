import { useQuery } from '@tanstack/react-query';
import { getMaTournee } from '../api/tournees';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatKm } from '../utils/formatters';
import { useAuth } from '../hooks/useAuth';

export default function ChauffeurDashboard() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const { data: tournee, isLoading } = useQuery({
    queryKey: ['ma-tournee'],
    queryFn: getMaTournee,
  });

  const deliveredCount = tournee?.stops?.filter((s) => s.statut === 'LIVRÉE').length ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-1">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bonjour{role === 'Chauffeur' ? ', chauffeur' : ''}</h1>
        <p className="text-sm text-gray-500">Votre espace de travail</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="card" />
      ) : tournee ? (
        <div
          onClick={() => navigate('/chauffeur/tournee')}
          className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow active:shadow-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Tournée du jour</h2>
            <StatusBadge statut={tournee.statut} />
          </div>

          <dl className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-[11px] text-gray-500">Arrêts</dt>
              <dd className="text-lg font-bold text-gray-900">{tournee.stops?.length ?? 0}</dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-[11px] text-gray-500">Livrés</dt>
              <dd className="text-lg font-bold text-green-600">{deliveredCount}</dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-[11px] text-gray-500">Distance</dt>
              <dd className="text-lg font-bold text-gray-900">{tournee.distance_totale ? formatKm(tournee.distance_totale) : 'N/A'}</dd>
            </div>
          </dl>

          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Progression</span>
            <span>{tournee.progression}%</span>
          </div>
          <div className="mb-4 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${tournee.progression}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Véhicule #{tournee.vehicule_id}</span>
            <span className="font-medium text-blue-600">Voir les détails →</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16">
          <svg className="mb-4 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-sm text-gray-500">Aucune tournée assignée pour aujourd'hui</p>
          <p className="mt-1 text-xs text-gray-400">Revenez plus tard ou contactez le dispatcheur</p>
        </div>
      )}
    </div>
  );
}
