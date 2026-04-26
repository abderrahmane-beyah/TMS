import client from "./client";

export interface OptimisationStatut {
  statut: string;
  progression: number;
}

export interface OptimisationResult {
  id: number;
  algorithme: string;
  distance_totale: number;
  vehicules_utilises: number;
  nb_commandes_non_servies: number;
  resultat_json: any;
}

export const lancerOptimisation = async (data: {
  algorithme: "CLARKE_WRIGHT" | "OR_TOOLS";
  commande_ids: number[];
  vehicule_ids: number[];
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

export const getOptimisationHistory = async () => {
  const response = await client.get("/optimisation/historique");
  return response.data;
};