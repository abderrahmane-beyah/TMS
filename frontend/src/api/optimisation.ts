import client from "./client";

export interface OptimisationStatut {
  statut: string;
  progression: number;
}

export interface OptimisationResult {
  id: number;
  algorithme: string;
  distance_totale: number;
  nb_vehicules_utilises: number;
  nb_commandes_non_servies: number;
  resultat_json: any;
  tournees?: any[];
  commandes_non_servies?: any[];
}

export interface OptimisationHistoryItem {
  id: number;
  date_execution: string | null;
  algorithme: string;
  statut: string;
  distance_totale: number | null;
  nb_vehicules_utilises: number | null;
  nb_commandes_non_servies: number | null;
  created_at: string;
}

export const lancerOptimisation = async (data: {
  algorithme: "HEURISTIQUE" | "OR_TOOLS";
  commande_ids: number[];
  vehicule_ids: number[];
  date: string;
}) => {
  const response = await client.post("/optimisation/lancer", data);
  return response.data;
};

export const getOptimisationStatut = async (id: number): Promise<OptimisationStatut> => {
  const response = await client.get(`/optimisation/${id}/statut`);
  return response.data;
};

export const getOptimisationResult = async (id: number): Promise<OptimisationResult> => {
  const response = await client.get(`/optimisation/${id}/resultat`);
  return response.data;
};

export const getOptimisationHistory = async (): Promise<OptimisationHistoryItem[]> => {
  const response = await client.get("/optimisation/historique");
  return response.data;
};