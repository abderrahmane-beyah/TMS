import { useQuery } from '@tanstack/react-query';
import { getOtd, getUtilisation, getNonServies } from '../api/kpis';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function Kpis() {
  const { data: otd, isLoading: loadingOtd } = useQuery({ queryKey: ['kpis-otd'], queryFn: getOtd });
  const { data: utilisation, isLoading: loadingUtil } = useQuery({ queryKey: ['kpis-utilisation'], queryFn: getUtilisation });
  const { data: nonServies, isLoading: loadingNS } = useQuery({ queryKey: ['kpis-non-servies'], queryFn: getNonServies });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Indicateurs de performance</h1>
        <p className="text-sm text-gray-500">Suivi des KPI sur les 30 derniers jours</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* OTD % */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Taux de livraison à temps (OTD %)</h3>
          {loadingOtd ? <LoadingSkeleton rows={4} /> :
            otd && otd.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={otd}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="taux" name="OTD %" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-gray-400">
                Aucune donnée disponible
              </div>
            )
          }
        </div>

        {/* Utilisation des véhicules */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Utilisation des véhicules (%)</h3>
          {loadingUtil ? <LoadingSkeleton rows={4} /> :
            utilisation && utilisation.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={utilisation}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="vehicule" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="taux" name="Utilisation %" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-gray-400">
                Aucune donnée disponible
              </div>
            )
          }
        </div>

        {/* Commandes non servies par l'optimisation */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Commandes non affectées par l'optimisation</h3>

          {loadingNS ? <LoadingSkeleton rows={4} /> :
            nonServies && nonServies.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={nonServies}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Non servies" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-gray-400">
                Aucune donnée disponible
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}
