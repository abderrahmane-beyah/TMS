import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, toggleActif } from '../api/admin';
import type { User, UserPayload } from '../api/admin';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';
import { ROLES } from '../utils/constants';

export default function Admin() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<User | null>(null);

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
          <p className="text-sm text-gray-500">Gestion des utilisateurs</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nouvel utilisateur
        </button>
      </div>

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
              {users?.map((u) => (
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
              ))}
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
