import type { Commande, PaginatedResponse } from './commandes';
import type { Tournee } from './tournees';
import type { Vehicule } from './vehicules';
import type { Chauffeur } from './chauffeurs';
import type { Anomalie } from './anomalies';
import type { OtdData, UtilisationData, CoutParKmData, NonServiesData } from './kpis';
import type { User } from './admin';
import type { OptimisationResult, OptimisationStatut } from './optimisation';

// --- Commandes ---
const commandes: Commande[] = [
  {
    id: 1, expediteur: 'Sahel Logistics', adresse_enlevement: 'Avenue Gamal Abdel Nasser, Nouakchott',
    adresse_livraison: 'Rue du Port, Nouadhibou', lat_enlevement: 18.0735, lon_enlevement: -15.9582,
    lat_livraison: 20.9420, lon_livraison: -17.0383, poids: 250, volume: 1.2,
    date_livraison: '2026-03-28', heure_ouverture: '08:00', heure_fermeture: '12:00', statut: 'EN_ATTENTE',
    created_at: '2026-03-27T08:30:00Z', updated_at: '2026-03-27T08:30:00Z',
    transitions: [{ statut: 'EN_ATTENTE', date: '2026-03-27T08:30:00Z' }],
  },
  {
    id: 2, expediteur: 'Ould Brahim Transport', adresse_enlevement: 'Avenue de l\'Indépendance, Nouakchott',
    adresse_livraison: 'Quartier Capital, Kiffa', lat_enlevement: 18.0863, lon_enlevement: -15.9785,
    lat_livraison: 16.6166, lon_livraison: -11.4042, poids: 180, volume: 0.8,
    date_livraison: '2026-03-28', heure_ouverture: '09:00', heure_fermeture: '14:00', statut: 'AFFECTÉE',
    created_at: '2026-03-26T14:00:00Z', updated_at: '2026-03-27T09:00:00Z',
    transitions: [
      { statut: 'EN_ATTENTE', date: '2026-03-26T14:00:00Z' },
      { statut: 'AFFECTÉE', date: '2026-03-27T09:00:00Z' },
    ],
  },
  {
    id: 3, expediteur: 'Trans Sahara SARL', adresse_enlevement: 'Zone Industrielle, Nouadhibou',
    adresse_livraison: 'Centre Ville, Atar', lat_enlevement: 20.9310, lon_enlevement: -17.0500,
    lat_livraison: 20.5169, lon_livraison: -13.0499, poids: 520, volume: 2.5,
    date_livraison: '2026-03-27', heure_ouverture: '07:00', heure_fermeture: '11:00', statut: 'EN_COURS',
    created_at: '2026-03-25T10:00:00Z', updated_at: '2026-03-27T07:30:00Z',
    transitions: [
      { statut: 'EN_ATTENTE', date: '2026-03-25T10:00:00Z' },
      { statut: 'AFFECTÉE', date: '2026-03-26T08:00:00Z' },
      { statut: 'EN_COURS', date: '2026-03-27T07:30:00Z' },
    ],
  },
  {
    id: 4, expediteur: 'Mauritanie Express', adresse_enlevement: 'Marché Capitale, Nouakchott',
    adresse_livraison: 'Route de Rosso, Rosso', lat_enlevement: 18.0900, lon_enlevement: -15.9750,
    lat_livraison: 16.5130, lon_livraison: -15.8050, poids: 320, volume: 1.5,
    date_livraison: '2026-03-26', heure_ouverture: '10:00', heure_fermeture: '16:00', statut: 'LIVRÉE',
    created_at: '2026-03-24T09:00:00Z', updated_at: '2026-03-26T14:20:00Z',
    transitions: [
      { statut: 'EN_ATTENTE', date: '2026-03-24T09:00:00Z' },
      { statut: 'AFFECTÉE', date: '2026-03-24T16:00:00Z' },
      { statut: 'EN_COURS', date: '2026-03-25T07:00:00Z' },
      { statut: 'LIVRÉE', date: '2026-03-26T14:20:00Z' },
    ],
  },
  {
    id: 5, expediteur: 'Sahel Logistics', adresse_enlevement: 'Quartier SOCOGIM, Nouakchott',
    adresse_livraison: 'Centre Minier, Zouérat', lat_enlevement: 18.0660, lon_enlevement: -15.9900,
    lat_livraison: 22.7354, lon_livraison: -12.4814, poids: 150, volume: 0.6,
    date_livraison: '2026-03-29', heure_ouverture: '08:00', heure_fermeture: '13:00', statut: 'EN_ATTENTE',
    created_at: '2026-03-27T07:00:00Z', updated_at: '2026-03-27T07:00:00Z',
    transitions: [{ statut: 'EN_ATTENTE', date: '2026-03-27T07:00:00Z' }],
  },
  {
    id: 6, expediteur: 'Atar Cargo', adresse_enlevement: 'Gare Routière, Atar',
    adresse_livraison: 'Boulevard Maritime, Nouadhibou', lat_enlevement: 20.5200, lon_enlevement: -13.0450,
    lat_livraison: 20.9420, lon_livraison: -17.0383, poids: 410, volume: 2.0,
    date_livraison: '2026-03-28', heure_ouverture: '06:00', heure_fermeture: '10:00', statut: 'EN_COURS',
    created_at: '2026-03-26T06:00:00Z', updated_at: '2026-03-27T06:15:00Z',
    transitions: [
      { statut: 'EN_ATTENTE', date: '2026-03-26T06:00:00Z' },
      { statut: 'AFFECTÉE', date: '2026-03-26T15:00:00Z' },
      { statut: 'EN_COURS', date: '2026-03-27T06:15:00Z' },
    ],
  },
  {
    id: 7, expediteur: 'Ould Brahim Transport', adresse_enlevement: 'Rue Mamadou Konaté, Nouakchott',
    adresse_livraison: 'Marché Central, Kaédi', lat_enlevement: 18.0800, lon_enlevement: -15.9650,
    lat_livraison: 16.1505, lon_livraison: -13.5046, poids: 50, volume: 0.3,
    date_livraison: '2026-03-28', heure_ouverture: '14:00', heure_fermeture: '17:00', statut: 'AFFECTÉE',
    created_at: '2026-03-27T10:00:00Z', updated_at: '2026-03-27T11:00:00Z',
    transitions: [
      { statut: 'EN_ATTENTE', date: '2026-03-27T10:00:00Z' },
      { statut: 'AFFECTÉE', date: '2026-03-27T11:00:00Z' },
    ],
  },
  {
    id: 8, expediteur: 'Trans Sahara SARL', adresse_enlevement: 'Avenue Abdel Nasser, Aleg',
    adresse_livraison: 'Quartier Administratif, Néma', lat_enlevement: 17.0532, lon_enlevement: -13.9120,
    lat_livraison: 16.6160, lon_livraison: -7.2564, poids: 280, volume: 1.1,
    date_livraison: '2026-03-29', heure_ouverture: '09:00', heure_fermeture: '15:00', statut: 'EN_ATTENTE',
    created_at: '2026-03-27T09:30:00Z', updated_at: '2026-03-27T09:30:00Z',
    transitions: [{ statut: 'EN_ATTENTE', date: '2026-03-27T09:30:00Z' }],
  },
];

// --- Tournées ---
const tournees: Tournee[] = [
  {
    id: 1, chauffeur_nom: 'Mohamed Ould Ahmed', vehicule_immatriculation: '1234 AA 01',
    date: '2026-03-28', statut: 'EN_COURS', nombre_stops: 3, distance_totale: 920.5, progression: 33,
    stops: [
      { id: 1, commande_id: 3, adresse: 'Zone Industrielle, Nouadhibou', lat: 20.9310, lon: -17.0500, ordre: 1, heure_prevue: '2026-03-28T07:30:00Z', heure_reelle: '2026-03-28T07:45:00Z', statut: 'LIVRÉE' },
      { id: 2, commande_id: 6, adresse: 'Boulevard Maritime, Nouadhibou', lat: 20.9420, lon: -17.0383, ordre: 2, heure_prevue: '2026-03-28T12:00:00Z', statut: 'EN_COURS' },
      { id: 3, commande_id: 5, adresse: 'Centre Minier, Zouérat', lat: 22.7354, lon: -12.4814, ordre: 3, heure_prevue: '2026-03-28T17:00:00Z', statut: 'EN_ATTENTE' },
    ],
    anomalies: [{ id: 1, type: 'RETARD', description: 'Retard de 15 min au stop 1 dû à un ensablement sur la route' }],
  },
  {
    id: 2, chauffeur_nom: 'Aminata Sy', vehicule_immatriculation: '5678 BA 01',
    date: '2026-03-28', statut: 'PLANIFIÉE', nombre_stops: 2, distance_totale: 680.4, progression: 0,
    stops: [
      { id: 4, commande_id: 2, adresse: 'Quartier Capital, Kiffa', lat: 16.6166, lon: -11.4042, ordre: 1, heure_prevue: '2026-03-28T09:00:00Z', statut: 'AFFECTÉE' },
      { id: 5, commande_id: 7, adresse: 'Marché Central, Kaédi', lat: 16.1505, lon: -13.5046, ordre: 2, heure_prevue: '2026-03-28T14:00:00Z', statut: 'AFFECTÉE' },
    ],
  },
  {
    id: 3, chauffeur_nom: 'Oumar Ba', vehicule_immatriculation: '9012 CA 01',
    date: '2026-03-28', statut: 'EN_COURS', nombre_stops: 2, distance_totale: 1100.7, progression: 50,
    stops: [
      { id: 6, commande_id: 8, adresse: 'Quartier Administratif, Néma', lat: 16.6160, lon: -7.2564, ordre: 1, heure_prevue: '2026-03-28T10:00:00Z', heure_reelle: '2026-03-28T10:10:00Z', statut: 'LIVRÉE' },
      { id: 7, commande_id: 1, adresse: 'Rue du Port, Nouadhibou', lat: 20.9420, lon: -17.0383, ordre: 2, heure_prevue: '2026-03-28T15:00:00Z', statut: 'EN_COURS' },
    ],
  },
];

// --- Véhicules ---
const vehicules: Vehicule[] = [
  { id: 1, immatriculation: '1234 AA 01', capacite_poids: 1000, capacite_volume: 5, statut: 'EN_MISSION' },
  { id: 2, immatriculation: '5678 BA 01', capacite_poids: 800, capacite_volume: 4, statut: 'DISPONIBLE' },
  { id: 3, immatriculation: '9012 CA 01', capacite_poids: 1200, capacite_volume: 6, statut: 'EN_MISSION' },
  { id: 4, immatriculation: '3456 DA 01', capacite_poids: 600, capacite_volume: 3, statut: 'DISPONIBLE' },
  { id: 5, immatriculation: '7890 EA 01', capacite_poids: 1500, capacite_volume: 8, statut: 'HORS_SERVICE' },
];

// --- Chauffeurs ---
const chauffeurs: Chauffeur[] = [
  { id: 1, nom: 'Mohamed Ould Ahmed', permis: 'C', statut: 'EN_MISSION' },
  { id: 2, nom: 'Aminata Sy', permis: 'C', statut: 'DISPONIBLE' },
  { id: 3, nom: 'Oumar Ba', permis: 'CE', statut: 'EN_MISSION' },
  { id: 4, nom: 'Mariem Mint Sidi', permis: 'C', statut: 'DISPONIBLE' },
];

// --- Anomalies ---
const anomalies: Anomalie[] = [
  { id: 1, tournee_id: 1, stop_id: 1, type: 'RETARD', description: 'Retard de 15 min dû à un ensablement sur la route Nouadhibou-Atar', date: '2026-03-28T07:45:00Z', statut: 'OUVERTE' },
  { id: 2, tournee_id: 1, stop_id: 2, type: 'COLIS_ENDOMMAGÉ', description: 'Emballage abîmé lors du chargement à Nouadhibou', date: '2026-03-28T08:00:00Z', statut: 'OUVERTE' },
  { id: 3, tournee_id: 3, type: 'ABSENCE_CLIENT', description: 'Client absent lors de la première tentative à Néma', date: '2026-03-27T14:30:00Z', statut: 'RÉSOLUE' },
];

// --- KPIs ---
function generateOtd(): OtdData[] {
  const data: OtdData[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({ date: d.toISOString().split('T')[0], taux: 78 + Math.random() * 18 });
  }
  return data;
}

const utilisationData: UtilisationData[] = [
  { vehicule: '1234 AA 01', taux: 87 },
  { vehicule: '5678 BA 01', taux: 62 },
  { vehicule: '9012 CA 01', taux: 91 },
  { vehicule: '3456 DA 01', taux: 45 },
  { vehicule: '7890 EA 01', taux: 0 },
];

function generateCout(): CoutParKmData[] {
  const data: CoutParKmData[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({ date: d.toISOString().split('T')[0], cout: 1.2 + Math.random() * 0.6 });
  }
  return data;
}

function generateNonServies(): NonServiesData[] {
  const data: NonServiesData[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({ date: d.toISOString().split('T')[0], count: Math.floor(Math.random() * 5) });
  }
  return data;
}

// --- Users ---
const users: User[] = [
  { id: 1, email: 'admin@tms.mr', nom: 'Sidi Mohamed Ould Cheikh', role: 'Administrateur', actif: true },
  { id: 2, email: 'dispatch@tms.mr', nom: 'Abdoulaye Diallo', role: 'Dispatcheur', actif: true },
  { id: 3, email: 'expediteur@tms.mr', nom: 'Fatimetou Mint Abdallahi', role: 'Expéditeur', actif: true },
  { id: 4, email: 'chauffeur@tms.mr', nom: 'Mohamed Ould Ahmed', role: 'Chauffeur', actif: true },
  { id: 5, email: 'ancien@tms.mr', nom: 'Khadijetou Mint Mohamed', role: 'Dispatcheur', actif: false },
];

// --- Optimisation mock ---
const mockOptResult: OptimisationResult = {
  id: 'opt-001',
  algorithme: 'clarke-wright',
  distance_totale: 2701.6,
  vehicules_utilises: 3,
  commandes_non_servies: [{ commande_id: 5, raison: 'Fenêtre de temps incompatible' }],
  tournees: [
    { vehicule_id: 1, vehicule_immatriculation: '1234 AA 01', stops: [{ commande_id: 3, adresse: 'Nouadhibou → Atar', ordre: 1 }, { commande_id: 6, adresse: 'Atar → Nouadhibou', ordre: 2 }], distance: 920.5 },
    { vehicule_id: 2, vehicule_immatriculation: '5678 BA 01', stops: [{ commande_id: 2, adresse: 'Nouakchott → Kiffa', ordre: 1 }, { commande_id: 7, adresse: 'Nouakchott → Kaédi', ordre: 2 }], distance: 680.4 },
    { vehicule_id: 3, vehicule_immatriculation: '9012 CA 01', stops: [{ commande_id: 8, adresse: 'Aleg → Néma', ordre: 1 }, { commande_id: 1, adresse: 'Nouakchott → Nouadhibou', ordre: 2 }], distance: 1100.7 },
  ],
};

// --- Delay helper ---
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- ID counters ---
let nextCommandeId = commandes.length + 1;
let nextVehiculeId = vehicules.length + 1;
let nextChauffeurId = chauffeurs.length + 1;
let nextUserId = users.length + 1;
let optimisationCallCount = 0;

// ====================================================
// Public mock API functions matching real API signatures
// ====================================================

export const mockApi = {
  // Auth
  login: async (_payload: { email: string; password: string }) => {
    await delay(400);
    // Any password works; role is based on email prefix
    const email = _payload.email.toLowerCase();
    let role = 'Dispatcheur';
    if (email.includes('admin')) role = 'Administrateur';
    else if (email.includes('exped')) role = 'Expéditeur';
    else if (email.includes('chauff')) role = 'Chauffeur';
    return { access_token: 'mock-jwt-token-' + Date.now(), role };
  },

  // Commandes
  getCommandes: async (params?: { page?: number; statut?: string; search?: string }): Promise<PaginatedResponse<Commande>> => {
    await delay(300);
    let filtered = [...commandes];
    if (params?.statut) filtered = filtered.filter((c) => c.statut === params.statut);
    if (params?.search) {
      const s = params.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.expediteur.toLowerCase().includes(s) ||
          c.adresse_enlevement.toLowerCase().includes(s) ||
          c.adresse_livraison.toLowerCase().includes(s)
      );
    }
    const page = params?.page || 1;
    const perPage = 10;
    const start = (page - 1) * perPage;
    return {
      items: filtered.slice(start, start + perPage),
      total: filtered.length,
      page,
      pages: Math.ceil(filtered.length / perPage),
    };
  },

  getCommande: async (id: number): Promise<Commande> => {
    await delay(200);
    const c = commandes.find((c) => c.id === id);
    if (!c) throw new Error('Not found');
    return c;
  },

  createCommande: async (payload: Omit<Commande, 'id' | 'expediteur' | 'statut' | 'created_at' | 'updated_at' | 'transitions'> & { date_livraison: string }): Promise<Commande> => {
    await delay(400);
    const now = new Date().toISOString();
    const c: Commande = {
      ...payload,
      id: nextCommandeId++,
      expediteur: 'Utilisateur courant',
      statut: 'EN_ATTENTE',
      created_at: now,
      updated_at: now,
      transitions: [{ statut: 'EN_ATTENTE', date: now }],
    };
    commandes.unshift(c);
    return c;
  },

  updateCommandeStatut: async (id: number, statut: string): Promise<Commande> => {
    await delay(300);
    const c = commandes.find((c) => c.id === id);
    if (!c) throw new Error('Not found');
    c.statut = statut;
    c.updated_at = new Date().toISOString();
    c.transitions = [...(c.transitions || []), { statut, date: c.updated_at }];
    return c;
  },

  deleteCommande: async (id: number): Promise<void> => {
    await delay(300);
    const idx = commandes.findIndex((c) => c.id === id);
    if (idx !== -1) commandes.splice(idx, 1);
  },

  // Tournées
  getTournees: async (): Promise<Tournee[]> => {
    await delay(300);
    return tournees;
  },

  getTournee: async (id: number): Promise<Tournee> => {
    await delay(200);
    const t = tournees.find((t) => t.id === id);
    if (!t) throw new Error('Not found');
    return t;
  },

  getMaTournee: async (): Promise<Tournee | null> => {
    await delay(300);
    // Return the first EN_COURS or PLANIFIÉE tournee (simulates "my assignment")
    return tournees.find((t) => ['EN_COURS', 'PLANIFIÉE'].includes(t.statut)) ?? null;
  },

  confirmerLivraison: async (tourneeId: number, stopId: number): Promise<Stop> => {
    await delay(400);
    const t = tournees.find((t) => t.id === tourneeId);
    if (!t) throw new Error('Tournée not found');
    const stop = t.stops?.find((s) => s.id === stopId);
    if (!stop) throw new Error('Stop not found');
    stop.statut = 'LIVRÉE';
    stop.heure_reelle = new Date().toISOString();
    // Update progression
    const total = t.stops?.length ?? 1;
    const done = t.stops?.filter((s) => s.statut === 'LIVRÉE').length ?? 0;
    t.progression = Math.round((done / total) * 100);
    if (done === total) t.statut = 'TERMINÉE';
    return stop;
  },

  signalerProbleme: async (tourneeId: number, stopId: number, description: string): Promise<Anomalie> => {
    await delay(400);
    const a: Anomalie = {
      id: anomalies.length + 1,
      tournee_id: tourneeId,
      stop_id: stopId,
      type: 'SIGNALEMENT_CHAUFFEUR',
      description,
      date: new Date().toISOString(),
      statut: 'OUVERTE',
    };
    anomalies.push(a);
    return a;
  },

  // Optimisation
  lancerOptimisation: async (): Promise<{ tache_id: string }> => {
    await delay(500);
    optimisationCallCount++;
    return { tache_id: `opt-${String(optimisationCallCount).padStart(3, '0')}` };
  },

  getOptimisationStatut: async (id: string): Promise<OptimisationStatut> => {
    await delay(200);
    // Simulate: first 2 polls return EN_COURS, then TERMINÉE
    const num = parseInt(id.split('-')[1]);
    const elapsed = Date.now() - (num * 1000);
    if (elapsed < 6000) return { statut: 'EN_COURS', progression: Math.min(90, elapsed / 100) };
    return { statut: 'TERMINÉE', progression: 100 };
  },

  getOptimisationResult: async (): Promise<OptimisationResult> => {
    await delay(300);
    return mockOptResult;
  },

  // Véhicules
  getVehicules: async (): Promise<Vehicule[]> => {
    await delay(200);
    return vehicules;
  },

  createVehicule: async (payload: { immatriculation: string; capacite_poids: number; capacite_volume: number; statut: string }): Promise<Vehicule> => {
    await delay(400);
    const v: Vehicule = { id: nextVehiculeId++, ...payload };
    vehicules.push(v);
    return v;
  },

  updateVehicule: async (id: number, payload: Partial<Vehicule>): Promise<Vehicule> => {
    await delay(300);
    const v = vehicules.find((v) => v.id === id);
    if (!v) throw new Error('Not found');
    Object.assign(v, payload);
    return v;
  },

  deleteVehicule: async (id: number): Promise<void> => {
    await delay(300);
    const idx = vehicules.findIndex((v) => v.id === id);
    if (idx !== -1) vehicules.splice(idx, 1);
  },

  // Chauffeurs
  getChauffeurs: async (): Promise<Chauffeur[]> => {
    await delay(200);
    return chauffeurs;
  },

  createChauffeur: async (payload: { nom: string; permis: string; statut: string }): Promise<Chauffeur> => {
    await delay(400);
    const c: Chauffeur = { id: nextChauffeurId++, ...payload };
    chauffeurs.push(c);
    return c;
  },

  updateChauffeur: async (id: number, payload: Partial<Chauffeur>): Promise<Chauffeur> => {
    await delay(300);
    const c = chauffeurs.find((c) => c.id === id);
    if (!c) throw new Error('Not found');
    Object.assign(c, payload);
    return c;
  },

  // Anomalies
  getAnomalies: async (): Promise<Anomalie[]> => {
    await delay(200);
    return anomalies;
  },

  resoudreAnomalie: async (id: number): Promise<Anomalie> => {
    await delay(300);
    const a = anomalies.find((a) => a.id === id);
    if (!a) throw new Error('Not found');
    a.statut = 'RÉSOLUE';
    return a;
  },

  // KPIs
  getOtd: async (): Promise<OtdData[]> => {
    await delay(200);
    return generateOtd();
  },

  getUtilisation: async (): Promise<UtilisationData[]> => {
    await delay(200);
    return utilisationData;
  },

  getCoutParKm: async (): Promise<CoutParKmData[]> => {
    await delay(200);
    return generateCout();
  },

  getNonServies: async (): Promise<NonServiesData[]> => {
    await delay(200);
    return generateNonServies();
  },

  // Admin
  getUsers: async (): Promise<User[]> => {
    await delay(200);
    return users;
  },

  createUser: async (payload: { email: string; nom: string; role: string; password?: string }): Promise<User> => {
    await delay(400);
    const u: User = { id: nextUserId++, email: payload.email, nom: payload.nom, role: payload.role, actif: true };
    users.push(u);
    return u;
  },

  updateUser: async (id: number, payload: Partial<User>): Promise<User> => {
    await delay(300);
    const u = users.find((u) => u.id === id);
    if (!u) throw new Error('Not found');
    Object.assign(u, payload);
    return u;
  },
};
