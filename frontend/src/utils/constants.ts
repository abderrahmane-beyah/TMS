export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

export const STATUT_COMMANDE = {
  EN_ATTENTE: 'EN_ATTENTE',
  AFFECTEE: 'AFFECTEE',
  EN_COURS: 'EN_COURS',
  LIVREE: 'LIVREE',
} as const;

export const STATUT_COLORS: Record<string, { bg: string; text: string }> = {
  EN_ATTENTE: { bg: 'bg-orange-100', text: 'text-orange-700' },
  AFFECTEE: { bg: 'bg-blue-100', text: 'text-blue-700' },
  EN_COURS: { bg: 'bg-green-100', text: 'text-green-700' },
  LIVREE: { bg: 'bg-purple-100', text: 'text-purple-700' },
  NON_AFFECTEE: { bg: 'bg-red-100', text: 'text-red-700' },
  TERMINEE: { bg: 'bg-purple-100', text: 'text-purple-700' },
  ANNULEE: { bg: 'bg-gray-100', text: 'text-gray-700' },
  PLANIFIEE: { bg: 'bg-blue-100', text: 'text-blue-700' },
  OUVERTE: { bg: 'bg-red-100', text: 'text-red-700' },
  RESOLUE: { bg: 'bg-green-100', text: 'text-green-700' },
  DISPONIBLE: { bg: 'bg-green-100', text: 'text-green-700' },
  EN_MISSION: { bg: 'bg-blue-100', text: 'text-blue-700' },
  HORS_SERVICE: { bg: 'bg-red-100', text: 'text-red-700' },
};

export const MARKER_COLORS: Record<string, string> = {
  EN_ATTENTE: '#f97316',
  AFFECTEE: '#3b82f6',
  EN_COURS: '#22c55e',
  LIVREE: '#a855f7',
  TERMINEE: '#a855f7',
};

export const ROLES = {
  EXPEDITEUR: 'EXPEDITEUR',
  DISPATCHEUR: 'DISPATCHEUR',
  CHAUFFEUR: 'CHAUFFEUR',
  ADMINISTRATEUR: 'ADMINISTRATEUR',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
