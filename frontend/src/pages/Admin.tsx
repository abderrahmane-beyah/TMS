import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, toggleActif } from '../api/admin';
import type { User, UserPayload } from '../api/admin';
import { getAllWarehouses, updateWarehouse, toggleWarehouseActif } from '../api/warehouses';
import type { Warehouse } from '../api/warehouses';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';
import { ROLES } from '../utils/constants';

type Tab = 'users' | 'warehouses';

export default function Admin() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <div className="mt-3 flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Utilisateurs
          </button>
          <button
            onClick={() => setTab('warehouses')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'warehouses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Entrepôts
          </button>
        </div>
      </div>

      {tab === 'users' ? <UsersTab /> : <WarehousesTab />}
    </div>
  );
}

/* ===================== USERS TAB ===================== */

function UsersTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); toast.success('Utilisateur créé'); },
    onError: () => toast.error('Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<UserPayload> }) => updateUser(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setEditing(null); toast.success('Utilisateur modifié'); },
    onError: () => toast.error('Erreur'),
  });

  const toggleActifMutation = useMutation({
    mutationFn: toggleActif,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Statut modifié'); },
    onError: () => toast.error('Erreur'),
  });

  const filteredUsers = users?.filter((u) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      u.nom.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      u.role.toLowerCase().includes(search)
    );
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="relative flex-1 mr-4">
          <input
            type="text"
            placeholder="Rechercher par nom, email ou rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nouvel utilisateur
        </button>
      </div>

      {searchTerm && (
        <p className="mb-2 text-sm text-gray-600">{filteredUsers?.length || 0} résultat(s) trouvé(s)</p>
      )}

      {(showForm || editing) && (
        <UserForm
          initial={editing}
          onSubmit={(payload) => {
            if (editing) updateMutation.mutate({ id: editing.id, payload });
            else createMutation.mutate(payload);
          }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {isLoading ? <LoadingSkeleton /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Rôle</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers && filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                filteredUsers?.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.nom}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.role}</td>
                    <td className="px-4 py-3">
                      <StatusBadge statut={u.actif ? 'DISPONIBLE' : 'HORS_SERVICE'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(u)} className="text-sm text-blue-600 hover:underline">
                          Modifier
                        </button>
                        <button
                          onClick={() => u.actif ? setConfirmDeactivate(u) : toggleActifMutation.mutate(u.id)}
                          className={`text-sm hover:underline ${u.actif ? 'text-red-600' : 'text-green-600'}`}
                        >
                          {u.actif ? 'Désactiver' : 'Activer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeactivate !== null}
        title="Désactiver l'utilisateur"
        message={`Êtes-vous sûr de vouloir désactiver ${confirmDeactivate?.nom} ? Il ne pourra plus se connecter.`}
        confirmLabel="Désactiver"
        onConfirm={() => {
          if (confirmDeactivate) {
            toggleActifMutation.mutate(confirmDeactivate.id);
            setConfirmDeactivate(null);
          }
        }}
        onCancel={() => setConfirmDeactivate(null)}
        loading={toggleActifMutation.isPending}
      />
    </>
  );
}

/* ===================== WAREHOUSES TAB ===================== */

function WarehousesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Warehouse | null>(null);

  const { data: warehouses, isLoading } = useQuery({ queryKey: ['warehouses', 'all'], queryFn: getAllWarehouses });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Warehouse> }) => updateWarehouse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setEditing(null);
      toast.success('Entrepôt modifié');
    },
    onError: () => toast.error('Erreur'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, actif }: { id: number; actif: boolean }) => toggleWarehouseActif(id, actif),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Statut modifié');
    },
    onError: () => toast.error('Erreur'),
  });

  return (
    <>
      {editing && (
        <WarehouseForm
          warehouse={editing}
          onSubmit={(data) => updateMutation.mutate({ id: editing.id, data })}
          onCancel={() => setEditing(null)}
          loading={updateMutation.isPending}
        />
      )}

      {isLoading ? <LoadingSkeleton /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Ville</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Adresse</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Horaires</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {warehouses && warehouses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucun entrepôt trouvé
                  </td>
                </tr>
              ) : (
                warehouses?.map((w) => (
                  <tr key={w.id} className={!w.actif ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{w.nom}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{w.ville}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{w.adresse}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {w.heure_ouverture && w.heure_fermeture
                        ? `${w.heure_ouverture.slice(0, 5)} - ${w.heure_fermeture.slice(0, 5)}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge statut={w.actif ? 'DISPONIBLE' : 'HORS_SERVICE'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(w)} className="text-sm text-blue-600 hover:underline">
                          Modifier
                        </button>
                        <button
                          onClick={() => w.actif ? setConfirmToggle(w) : toggleMutation.mutate({ id: w.id, actif: true })}
                          className={`text-sm hover:underline ${w.actif ? 'text-red-600' : 'text-green-600'}`}
                        >
                          {w.actif ? 'Désactiver' : 'Activer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmToggle !== null}
        title="Désactiver l'entrepôt"
        message={`Êtes-vous sûr de vouloir désactiver l'entrepôt "${confirmToggle?.nom}" ? Il ne sera plus disponible pour les commandes.`}
        confirmLabel="Désactiver"
        onConfirm={() => {
          if (confirmToggle) {
            toggleMutation.mutate({ id: confirmToggle.id, actif: false });
            setConfirmToggle(null);
          }
        }}
        onCancel={() => setConfirmToggle(null)}
        loading={toggleMutation.isPending}
      />
    </>
  );
}

/* ===================== FORMS ===================== */

function WarehouseForm({
  warehouse,
  onSubmit,
  onCancel,
  loading,
}: {
  warehouse: Warehouse;
  onSubmit: (data: Partial<Warehouse>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    nom: warehouse.nom,
    ville: warehouse.ville,
    adresse: warehouse.adresse,
    lat: warehouse.lat,
    lon: warehouse.lon,
    heure_ouverture: warehouse.heure_ouverture || '',
    heure_fermeture: warehouse.heure_fermeture || '',
  });

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">Modifier l'entrepôt</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Nom</label>
          <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Ville</label>
          <input value={form.ville} onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Adresse</label>
          <input value={form.adresse} onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Latitude</label>
          <input type="number" step="any" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: parseFloat(e.target.value) || 0 }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Longitude</label>
          <input type="number" step="any" value={form.lon} onChange={(e) => setForm((f) => ({ ...f, lon: parseFloat(e.target.value) || 0 }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Ouverture</label>
          <input type="time" value={form.heure_ouverture} onChange={(e) => setForm((f) => ({ ...f, heure_ouverture: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Fermeture</label>
          <input type="time" value={form.heure_fermeture} onChange={(e) => setForm((f) => ({ ...f, heure_fermeture: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => onSubmit(form)} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'En cours...' : 'Enregistrer'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
      </div>
    </div>
  );
}

function UserForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial: User | null;
  onSubmit: (p: UserPayload) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<UserPayload>(
    initial
      ? { email: initial.email, nom: initial.nom, role: initial.role }
      : { email: '', nom: '', role: ROLES.EXPEDITEUR, mot_de_passe: '' }
  );
  const [errs, setErrs] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (!form.nom.trim()) e.nom = 'Le nom est requis';
    if (!form.email.trim()) e.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email invalide';
    if (!initial && (!form.mot_de_passe || form.mot_de_passe.length < 4)) e.mot_de_passe = 'Minimum 4 caractères';
    setErrs(e);
    if (Object.keys(e).length === 0) onSubmit(form);
  };

  const cls = (field: string) =>
    `rounded-lg border px-3 py-2 text-sm ${errs[field] ? 'border-red-300' : 'border-gray-300'}`;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">
        {initial ? 'Modifier' : 'Nouvel'} utilisateur
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
        <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          {Object.values(ROLES).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
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
