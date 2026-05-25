import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVehicules, createVehicule, updateVehicule, deleteVehicule } from '../api/vehicules';
import { getChauffeurs, createChauffeur, updateChauffeur } from '../api/chauffeurs';
import { getWarehouses } from '../api/warehouses';
import type { Vehicule, VehiculePayload } from '../api/vehicules';
import type { Chauffeur, ChauffeurPayload } from '../api/chauffeurs';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

export default function Flotte() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'vehicules' | 'chauffeurs'>('vehicules');
  const [editingV, setEditingV] = useState<Vehicule | null>(null);
  const [editingC, setEditingC] = useState<Chauffeur | null>(null);
  const [showFormV, setShowFormV] = useState(false);
  const [showFormC, setShowFormC] = useState(false);
  const [confirmDeleteV, setConfirmDeleteV] = useState<number | null>(null);

  // Filtres pour véhicules
  const [searchV, setSearchV] = useState('');
  const [filterTypeV, setFilterTypeV] = useState('');
  const [filterStatutV, setFilterStatutV] = useState('');
  const [filterWarehouseV, setFilterWarehouseV] = useState('');

  // Filtres pour chauffeurs
  const [searchC, setSearchC] = useState('');
  const [filterStatutC, setFilterStatutC] = useState('');
  const [filterWarehouseC, setFilterWarehouseC] = useState('');

  const { data: vehicules, isLoading: loadingV } = useQuery({ queryKey: ['vehicules'], queryFn: getVehicules });
  const { data: chauffeurs, isLoading: loadingC } = useQuery({ queryKey: ['chauffeurs'], queryFn: getChauffeurs });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: getWarehouses });

  const createV = useMutation({
    mutationFn: createVehicule,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vehicules'] }); setShowFormV(false); toast.success('Véhicule créé'); },
    onError: () => toast.error('Erreur'),
  });

  const updateV = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<VehiculePayload> }) => updateVehicule(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vehicules'] }); setEditingV(null); toast.success('Véhicule modifié'); },
    onError: () => toast.error('Erreur'),
  });

  const deleteV = useMutation({
    mutationFn: deleteVehicule,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vehicules'] }); setConfirmDeleteV(null); toast.success('Véhicule supprimé'); },
    onError: () => toast.error('Erreur'),
  });

  const createC = useMutation({
    mutationFn: createChauffeur,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chauffeurs'] }); setShowFormC(false); toast.success('Chauffeur créé'); },
    onError: () => toast.error('Erreur'),
  });

  const updateC = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ChauffeurPayload> }) => updateChauffeur(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chauffeurs'] }); setEditingC(null); toast.success('Chauffeur modifié'); },
    onError: () => toast.error('Erreur'),
  });

  // Filtrage des véhicules
  const filteredVehicules = vehicules?.filter((v) => {
    const matchesSearch = searchV === '' || v.immatriculation.toLowerCase().includes(searchV.toLowerCase());
    const matchesType = filterTypeV === '' || v.type_vehicule === filterTypeV;
    const matchesStatut = filterStatutV === '' || v.statut === filterStatutV;
    const matchesWarehouse = filterWarehouseV === '' || v.warehouse_id === parseInt(filterWarehouseV);
    return matchesSearch && matchesType && matchesStatut && matchesWarehouse;
  });

  // Filtrage des chauffeurs
  const filteredChauffeurs = chauffeurs?.filter((c) => {
    const matchesSearch = searchC === '' ||
      c.nom.toLowerCase().includes(searchC.toLowerCase()) ||
      c.email.toLowerCase().includes(searchC.toLowerCase());
    const matchesStatut = filterStatutC === '' || c.statut === filterStatutC;
    const matchesWarehouse = filterWarehouseC === '' || c.warehouse_id === parseInt(filterWarehouseC);
    return matchesSearch && matchesStatut && matchesWarehouse;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Flotte</h1>
        <p className="text-sm text-gray-500">Gestion des véhicules et chauffeurs</p>
      </div>

      {/* Onglets */}
      <div className="mb-6 flex border-b border-gray-200">
        <button
          onClick={() => setTab('vehicules')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'vehicules' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Véhicules
        </button>
        <button
          onClick={() => setTab('chauffeurs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'chauffeurs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Chauffeurs
        </button>
      </div>

      {/* Onglet véhicules */}
      {tab === 'vehicules' && (
        <div>
          {/* Filtres véhicules */}
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={searchV}
                onChange={(e) => setSearchV(e.target.value)}
                placeholder="Rechercher par immatriculation..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={filterTypeV}
                onChange={(e) => setFilterTypeV(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tous les types</option>
                <option value="NORMAL"> Normal</option>
                <option value="REFRIGERE"> Réfrigéré</option>
                <option value="CONGELATEUR"> Congélateur</option>
              </select>
              <select
                value={filterStatutV}
                onChange={(e) => setFilterStatutV(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="DISPONIBLE">Disponible</option>
                <option value="EN_MISSION">En mission</option>
                <option value="HORS_SERVICE">Hors service</option>
              </select>
              <select
                value={filterWarehouseV}
                onChange={(e) => setFilterWarehouseV(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tous les entrepôts</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nom} - {w.ville}
                  </option>
                ))}
              </select>
              <button
                onClick={() => { setShowFormV(true); setEditingV(null); }}
                className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {(showFormV || editingV) && (
            <VehiculeForm
              initial={editingV}
              warehouses={warehouses || []}
              onSubmit={(payload) => {
                if (editingV) updateV.mutate({ id: editingV.id, payload });
                else createV.mutate(payload);
              }}
              onCancel={() => { setShowFormV(false); setEditingV(null); }}
              loading={createV.isPending || updateV.isPending}
            />
          )}

          {loadingV ? <LoadingSkeleton /> : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              {filteredVehicules && filteredVehicules.length > 0 && (
                <div className="border-b border-gray-200 px-4 py-2 text-xs text-gray-500">
                  {filteredVehicules.length} véhicule{filteredVehicules.length > 1 ? 's' : ''} affiché{filteredVehicules.length > 1 ? 's' : ''}
                  {(searchV || filterTypeV || filterStatutV || filterWarehouseV) && ` sur ${vehicules?.length} total`}
                </div>
              )}
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Immatriculation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Entrepôt</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Capacité poids</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Capacité volume</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredVehicules && filteredVehicules.length > 0 ? (
                    filteredVehicules.map((v) => (
                      <tr key={v.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.immatriculation}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {v.type_vehicule === 'REFRIGERE' ? ' Réfrigéré' : v.type_vehicule === 'CONGELATEUR' ? ' Congélateur' : ' Normal'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {warehouses?.find(w => w.id === v.warehouse_id)?.nom || v.ville || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{v.capacite_poids} kg</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{v.capacite_volume} m³</td>
                        <td className="px-4 py-3"><StatusBadge statut={v.statut} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => setEditingV(v)} className="text-sm text-blue-600 hover:underline">Modifier</button>
                            <button onClick={() => setConfirmDeleteV(v.id)} className="text-sm text-red-600 hover:underline">Supprimer</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                        Aucun véhicule trouvé
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteV !== null}
        title="Supprimer le véhicule"
        message="Êtes-vous sûr de vouloir supprimer ce véhicule ? Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={() => confirmDeleteV && deleteV.mutate(confirmDeleteV)}
        onCancel={() => setConfirmDeleteV(null)}
        loading={deleteV.isPending}
      />

      {/* Onglet chauffeurs */}
      {tab === 'chauffeurs' && (
        <div>
          {/* Filtres chauffeurs */}
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={searchC}
                onChange={(e) => setSearchC(e.target.value)}
                placeholder="Rechercher par nom ou email..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={filterStatutC}
                onChange={(e) => setFilterStatutC(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="DISPONIBLE">Disponible</option>
                <option value="EN_MISSION">En mission</option>
                <option value="HORS_SERVICE">Hors service</option>
              </select>
              <select
                value={filterWarehouseC}
                onChange={(e) => setFilterWarehouseC(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tous les entrepôts</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nom} - {w.ville}
                  </option>
                ))}
              </select>
              <button
                onClick={() => { setShowFormC(true); setEditingC(null); }}
                className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {(showFormC || editingC) && (
            <ChauffeurForm
              initial={editingC}
              warehouses={warehouses || []}
              onSubmit={(payload) => {
                if (editingC) updateC.mutate({ id: editingC.id, payload });
                else createC.mutate(payload);
              }}
              onCancel={() => { setShowFormC(false); setEditingC(null); }}
              loading={createC.isPending || updateC.isPending}
            />
          )}

          {loadingC ? <LoadingSkeleton /> : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              {filteredChauffeurs && filteredChauffeurs.length > 0 && (
                <div className="border-b border-gray-200 px-4 py-2 text-xs text-gray-500">
                  {filteredChauffeurs.length} chauffeur{filteredChauffeurs.length > 1 ? 's' : ''} affiché{filteredChauffeurs.length > 1 ? 's' : ''}
                  {(searchC || filterStatutC || filterWarehouseC) && ` sur ${chauffeurs?.length} total`}
                </div>
              )}
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Entrepôt</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Téléphone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredChauffeurs && filteredChauffeurs.length > 0 ? (
                    filteredChauffeurs.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.nom}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {warehouses?.find(w => w.id === c.warehouse_id)?.nom || c.ville || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.telephone || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge statut={c.statut} /></td>
                        <td className="px-4 py-3">
                          <button onClick={() => setEditingC(c)} className="text-sm text-blue-600 hover:underline">Modifier</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        Aucun chauffeur trouvé
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VehiculeForm({
  initial,
  warehouses,
  onSubmit,
  onCancel,
  loading,
}: {
  initial: Vehicule | null;
  warehouses: any[];
  onSubmit: (p: VehiculePayload) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<VehiculePayload>(
    initial ?? { immatriculation: '', capacite_poids: 0, capacite_volume: 0, type_vehicule: 'NORMAL', statut: 'DISPONIBLE' }
  );
  const [errs, setErrs] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (!form.immatriculation.trim()) e.immatriculation = "L'immatriculation est requise";
    if (!form.capacite_poids || form.capacite_poids <= 0) e.capacite_poids = 'Capacité poids requise';
    if (!form.capacite_volume || form.capacite_volume <= 0) e.capacite_volume = 'Capacité volume requise';
    setErrs(e);
    if (Object.keys(e).length === 0) onSubmit(form);
  };

  const cls = (field: string) =>
    `rounded-lg border px-3 py-2 text-sm ${errs[field] ? 'border-red-300' : 'border-gray-300'}`;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">{initial ? 'Modifier' : 'Nouveau'} véhicule</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <div>
          <input placeholder="Immatriculation" value={form.immatriculation} onChange={(e) => setForm((f) => ({ ...f, immatriculation: e.target.value }))} className={cls('immatriculation')} />
          {errs.immatriculation && <p className="mt-1 text-xs text-red-500">{errs.immatriculation}</p>}
        </div>
        <select
          value={form.type_vehicule || 'NORMAL'}
          onChange={(e) => setForm((f) => ({ ...f, type_vehicule: e.target.value as 'NORMAL' | 'REFRIGERE' | 'CONGELATEUR' }))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="NORMAL"> Normal</option>
          <option value="REFRIGERE"> Réfrigéré</option>
          <option value="CONGELATEUR"> Congélateur</option>
        </select>
        <select
          value={form.warehouse_id || ''}
          onChange={(e) => {
            const warehouseId = e.target.value ? parseInt(e.target.value) : undefined;
            const warehouse = warehouses.find(w => w.id === warehouseId);
            setForm((f) => ({
              ...f,
              warehouse_id: warehouseId,
              ville: warehouse?.ville
            }));
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Entrepôt...</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.nom} - {w.ville}
            </option>
          ))}
        </select>
        <div>
          <input type="number" placeholder="Capacité poids (kg)" value={form.capacite_poids || ''} onChange={(e) => setForm((f) => ({ ...f, capacite_poids: parseFloat(e.target.value) || 0 }))} className={cls('capacite_poids')} />
          {errs.capacite_poids && <p className="mt-1 text-xs text-red-500">{errs.capacite_poids}</p>}
        </div>
        <div>
          <input type="number" placeholder="Capacité volume (m³)" value={form.capacite_volume || ''} onChange={(e) => setForm((f) => ({ ...f, capacite_volume: parseFloat(e.target.value) || 0 }))} className={cls('capacite_volume')} />
          {errs.capacite_volume && <p className="mt-1 text-xs text-red-500">{errs.capacite_volume}</p>}
        </div>
        <select value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="DISPONIBLE">Disponible</option>
          <option value="EN_MISSION">En mission</option>
          <option value="HORS_SERVICE">Hors service</option>
        </select>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={handleSubmit} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'En cours...' : 'Enregistrer'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
      </div>
    </div>
  );
}

function ChauffeurForm({
  initial,
  warehouses,
  onSubmit,
  onCancel,
  loading,
}: {
  initial: Chauffeur | null;
  warehouses: any[];
  onSubmit: (p: ChauffeurPayload) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ChauffeurPayload>(
    initial ?? { nom: '', email: '', telephone: '', statut: 'DISPONIBLE' }
  );
  const [errs, setErrs] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (!form.nom.trim()) e.nom = 'Le nom est requis';
    if (!form.email.trim()) e.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email invalide';
    if (!initial && !form.mot_de_passe) e.mot_de_passe = 'Le mot de passe est requis';
    setErrs(e);
    if (Object.keys(e).length === 0) onSubmit(form);
  };

  const cls = (field: string) =>
    `rounded-lg border px-3 py-2 text-sm ${errs[field] ? 'border-red-300' : 'border-gray-300'}`;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">{initial ? 'Modifier' : 'Nouveau'} chauffeur</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div>
          <input placeholder="Nom" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className={cls('nom')} />
          {errs.nom && <p className="mt-1 text-xs text-red-500">{errs.nom}</p>}
        </div>
        <div>
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={cls('email')} />
          {errs.email && <p className="mt-1 text-xs text-red-500">{errs.email}</p>}
        </div>
        {!initial && (
          <div>
            <input type="password" placeholder="Mot de passe" value={form.mot_de_passe || ''} onChange={(e) => setForm((f) => ({ ...f, mot_de_passe: e.target.value }))} className={cls('mot_de_passe')} />
            {errs.mot_de_passe && <p className="mt-1 text-xs text-red-500">{errs.mot_de_passe}</p>}
          </div>
        )}
        <select
          value={form.warehouse_id || ''}
          onChange={(e) => {
            const warehouseId = e.target.value ? parseInt(e.target.value) : undefined;
            const warehouse = warehouses.find(w => w.id === warehouseId);
            setForm((f) => ({
              ...f,
              warehouse_id: warehouseId,
              ville: warehouse?.ville
            }));
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Entrepôt...</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.nom} - {w.ville}
            </option>
          ))}
        </select>
        <div>
          <input type="tel" placeholder="Téléphone" value={form.telephone || ''} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className={cls('telephone')} />
        </div>
        <select value={form.statut || 'DISPONIBLE'} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="DISPONIBLE">Disponible</option>
          <option value="EN_MISSION">En mission</option>
          <option value="HORS_SERVICE">Hors service</option>
        </select>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={handleSubmit} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'En cours...' : 'Enregistrer'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
      </div>
    </div>
  );
}
