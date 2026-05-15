import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCommande } from '../api/commandes';
import StatusBadge from '../components/StatusBadge';
import MapView from '../components/MapView';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatDateTime } from '../utils/formatters';
import type { MapMarker } from '../components/MapView';

export default function CommandeDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: commande, isLoading } = useQuery({
    queryKey: ['commande', id],
    queryFn: () => getCommande(Number(id)),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSkeleton type="text" rows={10} />;
  if (!commande) return <p className="text-gray-500">Commande introuvable</p>;

  const markers: MapMarker[] = [];
  if (commande.lat_enlevement && commande.lon_enlevement) {
    markers.push({
      lat: commande.lat_enlevement,
      lon: commande.lon_enlevement,
      statut: 'EN_ATTENTE',
      popup: `Enlèvement — ${commande.adresse_enlevement}`,
    });
  }
  if (commande.lat_livraison && commande.lon_livraison) {
    markers.push({
      lat: commande.lat_livraison,
      lon: commande.lon_livraison,
      statut: commande.statut,
      popup: `Livraison — ${commande.adresse_livraison}`,
    });
  }

  const timelineSteps = [
    { statut: 'EN_ATTENTE', label: 'En attente' },
    { statut: 'AFFECTÉE', label: 'Affectée' },
    { statut: 'EN_COURS', label: 'En cours' },
    { statut: 'LIVRÉE', label: 'Livrée' },
  ];

  const currentIdx = timelineSteps.findIndex((s) => s.statut === commande.statut);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Commande #{commande.id}</h1>
        <StatusBadge statut={commande.statut} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Détails</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Expéditeur</dt>
              <dd className="text-sm font-medium text-gray-900">#{commande.expediteur_id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Enlèvement</dt>
              <dd className="text-sm text-gray-900 text-right max-w-[60%]">{commande.adresse_enlevement}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Livraison</dt>
              <dd className="text-sm text-gray-900 text-right max-w-[60%]">{commande.adresse_livraison}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Poids</dt>
              <dd className="text-sm font-medium text-gray-900">{commande.poids} kg</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Volume</dt>
              <dd className="text-sm font-medium text-gray-900">{commande.volume} m³</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Date de livraison</dt>
              <dd className="text-sm font-medium text-gray-900">{commande.date_livraison}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Fenêtre horaire</dt>
              <dd className="text-sm font-medium text-gray-900">
                {commande.heure_ouverture} — {commande.heure_fermeture}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Créée le</dt>
              <dd className="text-sm text-gray-900">{formatDateTime(commande.created_at)}</dd>
            </div>
          </dl>
        </div>

        {/* Map */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Carte</h2>
          <MapView markers={markers} className="h-72" />
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 font-semibold text-gray-900">Chronologie</h2>
        <div className="flex items-center justify-between">
          {timelineSteps.map((step, i) => {
            const isActive = i <= currentIdx;
            return (
              <div key={step.statut} className="flex flex-1 flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i + 1}
                </div>
                <p className={`mt-2 text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {i < timelineSteps.length - 1 && (
                  <div className="absolute" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex">
          {timelineSteps.slice(0, -1).map((_, i) => (
            <div key={i} className="flex-1 px-5">
              <div className={`h-1 rounded ${i < currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
