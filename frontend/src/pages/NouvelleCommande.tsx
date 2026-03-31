import { useState, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createCommande } from '../api/commandes';
import { useGeocoding } from '../hooks/useGeocoding';
import toast from 'react-hot-toast';

interface FieldErrors {
  adresse_enlevement?: string;
  adresse_livraison?: string;
  poids?: string;
  volume?: string;
  date_livraison?: string;
  heure_ouverture?: string;
  heure_fermeture?: string;
}

export default function NouvelleCommande() {
  const navigate = useNavigate();
  const { geocode, loading: geocoding } = useGeocoding();

  const [form, setForm] = useState({
    adresse_enlevement: '',
    adresse_livraison: '',
    lat_enlevement: 0,
    lon_enlevement: 0,
    lat_livraison: 0,
    lon_livraison: 0,
    poids: '',
    volume: '',
    date_livraison: '',
    heure_ouverture: '',
    heure_fermeture: '',
  });

  const [geocodeStatus, setGeocodeStatus] = useState<{
    pickup: { status: 'idle' | 'loading' | 'success' | 'error'; text: string };
    delivery: { status: 'idle' | 'loading' | 'success' | 'error'; text: string };
  }>({
    pickup: { status: 'idle', text: '' },
    delivery: { status: 'idle', text: '' },
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const mutation = useMutation({
    mutationFn: createCommande,
    onSuccess: () => {
      toast.success('Commande créée avec succès');
      navigate('/commandes');
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const handleGeocodePickup = useCallback(async () => {
    if (form.adresse_enlevement.length < 5) return;
    setGeocodeStatus((s) => ({ ...s, pickup: { status: 'loading', text: 'Résolution...' } }));
    const result = await geocode(form.adresse_enlevement);
    if (result) {
      setForm((f) => ({ ...f, lat_enlevement: result.lat, lon_enlevement: result.lon }));
      setGeocodeStatus((s) => ({ ...s, pickup: { status: 'success', text: `${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}` } }));
      setErrors((e) => ({ ...e, adresse_enlevement: undefined }));
    } else {
      setForm((f) => ({ ...f, lat_enlevement: 0, lon_enlevement: 0 }));
      setGeocodeStatus((s) => ({ ...s, pickup: { status: 'error', text: 'Adresse non trouvée' } }));
    }
  }, [form.adresse_enlevement, geocode]);

  const handleGeocodeDelivery = useCallback(async () => {
    if (form.adresse_livraison.length < 5) return;
    setGeocodeStatus((s) => ({ ...s, delivery: { status: 'loading', text: 'Résolution...' } }));
    const result = await geocode(form.adresse_livraison);
    if (result) {
      setForm((f) => ({ ...f, lat_livraison: result.lat, lon_livraison: result.lon }));
      setGeocodeStatus((s) => ({ ...s, delivery: { status: 'success', text: `${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}` } }));
      setErrors((e) => ({ ...e, adresse_livraison: undefined }));
    } else {
      setForm((f) => ({ ...f, lat_livraison: 0, lon_livraison: 0 }));
      setGeocodeStatus((s) => ({ ...s, delivery: { status: 'error', text: 'Adresse non trouvée' } }));
    }
  }, [form.adresse_livraison, geocode]);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!form.adresse_enlevement.trim()) e.adresse_enlevement = "L'adresse d'enlèvement est requise";
    else if (!form.lat_enlevement) e.adresse_enlevement = "L'adresse n'a pas pu être géocodée";
    if (!form.adresse_livraison.trim()) e.adresse_livraison = "L'adresse de livraison est requise";
    else if (!form.lat_livraison) e.adresse_livraison = "L'adresse n'a pas pu être géocodée";
    if (!form.poids) e.poids = 'Le poids est requis';
    else if (parseFloat(form.poids) <= 0) e.poids = 'Le poids doit être positif';
    if (!form.volume) e.volume = 'Le volume est requis';
    else if (parseFloat(form.volume) <= 0) e.volume = 'Le volume doit être positif';
    if (!form.date_livraison) e.date_livraison = 'La date de livraison est requise';
    if (!form.heure_ouverture) e.heure_ouverture = "L'heure d'ouverture est requise";
    if (!form.heure_fermeture) e.heure_fermeture = "L'heure de fermeture est requise";
    if (form.heure_ouverture && form.heure_fermeture && form.heure_ouverture >= form.heure_fermeture) {
      e.heure_fermeture = "L'heure de fermeture doit être après l'ouverture";
    }
    return e;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    // Mark all as touched
    setTouched({ adresse_enlevement: true, adresse_livraison: true, poids: true, volume: true, date_livraison: true, heure_ouverture: true, heure_fermeture: true });
    if (Object.keys(validationErrors).length > 0) return;
    mutation.mutate({
      ...form,
      poids: parseFloat(form.poids),
      volume: parseFloat(form.volume),
    });
  };

  const markTouched = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const inputCls = (field: keyof FieldErrors) =>
    `block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 ${
      touched[field] && errors[field]
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
    }`;

  const geocodeStatusColor = (s: typeof geocodeStatus.pickup) => {
    if (s.status === 'loading') return 'text-gray-500';
    if (s.status === 'success') return 'text-green-600';
    if (s.status === 'error') return 'text-red-500';
    return 'text-gray-400';
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle commande</h1>
        <p className="text-sm text-gray-500">Créer une nouvelle commande de transport</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm" noValidate>
        {/* Pickup address */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Adresse d'enlèvement</label>
          <input
            type="text"
            value={form.adresse_enlevement}
            onChange={(e) => {
              setForm((f) => ({ ...f, adresse_enlevement: e.target.value, lat_enlevement: 0, lon_enlevement: 0 }));
              setGeocodeStatus((s) => ({ ...s, pickup: { status: 'idle', text: '' } }));
            }}
            onBlur={() => { markTouched('adresse_enlevement'); handleGeocodePickup(); }}
            className={inputCls('adresse_enlevement')}
            placeholder="Avenue Gamal Abdel Nasser, Nouakchott"
          />
          {geocodeStatus.pickup.text && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${geocodeStatusColor(geocodeStatus.pickup)}`}>
              {geocodeStatus.pickup.status === 'loading' && (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {geocodeStatus.pickup.text}
            </p>
          )}
          {touched.adresse_enlevement && errors.adresse_enlevement && !geocodeStatus.pickup.text && (
            <p className="mt-1 text-xs text-red-500">{errors.adresse_enlevement}</p>
          )}
        </div>

        {/* Delivery address */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Adresse de livraison</label>
          <input
            type="text"
            value={form.adresse_livraison}
            onChange={(e) => {
              setForm((f) => ({ ...f, adresse_livraison: e.target.value, lat_livraison: 0, lon_livraison: 0 }));
              setGeocodeStatus((s) => ({ ...s, delivery: { status: 'idle', text: '' } }));
            }}
            onBlur={() => { markTouched('adresse_livraison'); handleGeocodeDelivery(); }}
            className={inputCls('adresse_livraison')}
            placeholder="Rue du Port, Nouadhibou"
          />
          {geocodeStatus.delivery.text && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${geocodeStatusColor(geocodeStatus.delivery)}`}>
              {geocodeStatus.delivery.status === 'loading' && (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {geocodeStatus.delivery.text}
            </p>
          )}
          {touched.adresse_livraison && errors.adresse_livraison && !geocodeStatus.delivery.text && (
            <p className="mt-1 text-xs text-red-500">{errors.adresse_livraison}</p>
          )}
        </div>

        {/* Weight + Volume */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Poids (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.poids}
              onChange={(e) => setForm((f) => ({ ...f, poids: e.target.value }))}
              onBlur={() => markTouched('poids')}
              className={inputCls('poids')}
            />
            {touched.poids && errors.poids && <p className="mt-1 text-xs text-red-500">{errors.poids}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Volume (m³)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.volume}
              onChange={(e) => setForm((f) => ({ ...f, volume: e.target.value }))}
              onBlur={() => markTouched('volume')}
              className={inputCls('volume')}
            />
            {touched.volume && errors.volume && <p className="mt-1 text-xs text-red-500">{errors.volume}</p>}
          </div>
        </div>

        {/* Delivery date + Time window */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Date de livraison</label>
            <input
              type="date"
              value={form.date_livraison}
              onChange={(e) => setForm((f) => ({ ...f, date_livraison: e.target.value }))}
              onBlur={() => markTouched('date_livraison')}
              className={inputCls('date_livraison')}
            />
            {touched.date_livraison && errors.date_livraison && <p className="mt-1 text-xs text-red-500">{errors.date_livraison}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Heure d'ouverture</label>
            <input
              type="time"
              value={form.heure_ouverture}
              onChange={(e) => setForm((f) => ({ ...f, heure_ouverture: e.target.value }))}
              onBlur={() => markTouched('heure_ouverture')}
              className={inputCls('heure_ouverture')}
            />
            {touched.heure_ouverture && errors.heure_ouverture && <p className="mt-1 text-xs text-red-500">{errors.heure_ouverture}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Heure de fermeture</label>
            <input
              type="time"
              value={form.heure_fermeture}
              onChange={(e) => setForm((f) => ({ ...f, heure_fermeture: e.target.value }))}
              onBlur={() => markTouched('heure_fermeture')}
              className={inputCls('heure_fermeture')}
            />
            {touched.heure_fermeture && errors.heure_fermeture && <p className="mt-1 text-xs text-red-500">{errors.heure_fermeture}</p>}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending || geocoding}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {mutation.isPending ? 'Création...' : 'Créer la commande'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/commandes')}
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
