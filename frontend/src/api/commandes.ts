import client from "./client";

export interface Commande {
  id: number;
  expediteur_id: number;
  expediteur_nom?: string;
  warehouse_id?: number;
  adresse_livraison: string;
  lat_livraison: number;
  lon_livraison: number;
  poids: number;
  volume: number;
  date_livraison: string;
  heure_ouverture: string;
  heure_fermeture: string;
  statut: string;
  type_vehicule_requis?: 'NORMAL' | 'REFRIGERE' | 'CONGELATEUR';
  vehicule_id?: number;
  chauffeur_id?: number;
  created_at: string;
}

export const getCommandes = async (params?: {
  statut?: string;
  warehouse_id?: number;
  skip?: number;
  limit?: number;
}): Promise<Commande[]> => {
  const response = await client.get("/commandes/", { params });
  return response.data;
};

export const getCommande = async (id: number): Promise<Commande> => {
  const response = await client.get(`/commandes/${id}`);
  return response.data;
};

export const createCommande = async (data: Partial<Commande>): Promise<Commande> => {
  const response = await client.post("/commandes/", data);
  return response.data;
};

export const updateCommande = async (id: number, data: Partial<Commande>): Promise<Commande> => {
  const response = await client.patch(`/commandes/${id}`, data);
  return response.data;
};

export const updateCommandeStatut = async (id: number, statut: string): Promise<Commande> => {
  const response = await client.patch(`/commandes/${id}/statut`, { statut });
  return response.data;
};

export const affecterCommande = async (
  id: number,
  vehicule_id: number,
  chauffeur_id: number
): Promise<Commande> => {
  const response = await client.patch(`/commandes/${id}/affecter`, {
    vehicule_id,
    chauffeur_id,
  });
  return response.data;
};

export const deleteCommande = async (id: number): Promise<void> => {
  await client.delete(`/commandes/${id}`);
};