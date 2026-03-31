import { useState, type FormEvent } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getVehicules } from '../api/vehicules';
import { getCommandes } from '../api/commandes';
import { lancerOptimisation } from '../api/optimisation';
import { useOptimisationPolling } from '../hooks/useOptimisationPolling';
import LoadingSkeleton from '../components/LoadingSkeleton';
import toast from 'react-hot-toast';

export default function Optimisation() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVehicules, setSelectedVehicules] = useState<number[]>([]);
  const [selectedCommandes, setSelectedCommandes] = useState<number[]>([]);
  const [algorithme, setAlgorithme] = useState<'clarke-wright' | 'or-tools'>('clarke-wright');

  const [tacheIdCW, setTacheIdCW] = useState<string | null>(null);
  const [tacheIdOR, setTacheIdOR] = useState<string | null>(null);

  const { data: vehicules, isLoading: loadingV } = useQuery({
    queryKey: ['vehicules'],
    queryFn: getVehicules,
  });

  const { data: commandes, isLoading: loadingC } = useQuery({
    queryKey: ['commandes', { statut: 'EN_ATTENTE' }],
    queryFn: () => getCommandes({ statut: 'EN_ATTENTE' }),
  });

  const cwPolling = useOptimisationPolling(tacheIdCW);
  const orPolling = useOptimisationPolling(tacheIdOR);

  const launchMutation = useMutation({
    mutationFn: lancerOptimisation,
    onSuccess: (data) => {
      if (algorithme === 'clarke-wright') setTacheIdCW(data.tache_id);
      else setTacheIdOR(data.tache_id);
      toast.success(`Optimisation ${algorithme} lancée`);
    },
    onError: () => toast.error("Erreur lors du lancement"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (selectedVehicules.length === 0) {
      toast.error('Sélectionnez au moins un véhicule');
      return;
    }
    if (selectedCommandes.length === 0) {
      toast.error('Sélectionnez au moins une commande');
      return;
    }
    launchMutation.mutate({
      date,
      vehicule_ids: selectedVehicules,
      commande_ids: selectedCommandes,
      algorithme,
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

  const isRunning = cwPolling.isPolling || orPolling.isPolling;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Optimisation</h1>
        <p className="text-sm text-gray-500">Lancer et comparer les algorithmes d'optimisation</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Algorithme</label>
            <select
              value={algorithme}
              onChange={(e) => setAlgorithme(e.target.value as 'clarke-wright' | 'or-tools')}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="clarke-wright">Clarke-Wright</option>
              <option value="or-tools">OR-Tools</option>
            </select>
          </div>
        </div>

        {/* Vehicles selector */}
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Véhicules disponibles ({selectedVehicules.length} sélectionnés)
          </h3>
          {loadingV ? (
            <LoadingSkeleton rows={2} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {vehicules
                ?.filter((v) => v.statut === 'DISPONIBLE')
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
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Orders selector */}
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Commandes en attente ({selectedCommandes.length} sélectionnées)
          </h3>
          {loadingC ? (
            <LoadingSkeleton rows={2} />
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
              {commandes?.items.map((c) => (
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
                  <span className="text-sm text-gray-900">
                    #{c.id} — {c.adresse_livraison} ({c.poids} kg)
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
      </form>

      {/* Results */}
      {(cwPolling.result || orPolling.result) && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Résultats</h2>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {cwPolling.result && (
              <ResultPanel title="Clarke-Wright" result={cwPolling.result} />
            )}
            {orPolling.result && (
              <ResultPanel title="OR-Tools" result={orPolling.result} />
            )}
          </div>

          {/* Comparison table */}
          {cwPolling.result && orPolling.result && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">Comparaison</h3>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left text-gray-500">Métrique</th>
                    <th className="py-2 text-right text-gray-500">Clarke-Wright</th>
                    <th className="py-2 text-right text-gray-500">OR-Tools</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 text-gray-700">Distance totale</td>
                    <td className="py-2 text-right font-medium">{cwPolling.result.distance_totale.toFixed(1)} km</td>
                    <td className="py-2 text-right font-medium">{orPolling.result.distance_totale.toFixed(1)} km</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-gray-700">Véhicules utilisés</td>
                    <td className="py-2 text-right font-medium">{cwPolling.result.vehicules_utilises}</td>
                    <td className="py-2 text-right font-medium">{orPolling.result.vehicules_utilises}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-700">Commandes non servies</td>
                    <td className="py-2 text-right font-medium">{cwPolling.result.commandes_non_servies.length}</td>
                    <td className="py-2 text-right font-medium">{orPolling.result.commandes_non_servies.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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
          <p className="text-lg font-bold text-blue-900">{result.distance_totale.toFixed(1)} km</p>
        </div>
        <div className="rounded-lg bg-green-50 p-3 text-center">
          <p className="text-xs text-green-600">Véhicules</p>
          <p className="text-lg font-bold text-green-900">{result.vehicules_utilises}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <p className="text-xs text-red-600">Non servies</p>
          <p className="text-lg font-bold text-red-900">{result.commandes_non_servies.length}</p>
        </div>
      </div>

      {/* Tournees breakdown */}
      <div className="space-y-2">
        {result.tournees.map((t, i) => (
          <div key={i} className="rounded-lg border border-gray-100 p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">{t.vehicule_immatriculation}</span>
              <span className="text-gray-500">{t.distance.toFixed(1)} km — {t.stops.length} arrêts</span>
            </div>
          </div>
        ))}
      </div>

      {/* Unserved orders */}
      {result.commandes_non_servies.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-medium uppercase text-red-600">Non servies</h4>
          {result.commandes_non_servies.map((c) => (
            <p key={c.commande_id} className="text-xs text-red-700">
              #{c.commande_id} — {c.raison}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
