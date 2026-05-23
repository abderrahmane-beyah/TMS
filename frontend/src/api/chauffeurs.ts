import client from "./client";

export interface Chauffeur {
  id: number;
  nom: string;
  email: string;
  telephone?: string;
  ville?: string;
  warehouse_id?: number;
  statut: string;
  actif: boolean;
}

export interface ChauffeurPayload {
  nom: string;
  email: string;
  mot_de_passe?: string;
  telephone?: string;
  ville?: string;
  warehouse_id?: number;
  statut?: string;
}

export const getChauffeurs = async (): Promise<Chauffeur[]> => {
  const response = await client.get("/chauffeurs/");
  return response.data;
};

export const createChauffeur = async (data: ChauffeurPayload): Promise<Chauffeur> => {
  const response = await client.post("/chauffeurs/", data);
  return response.data;
};

export const updateChauffeur = async (id: number, data: Partial<ChauffeurPayload>): Promise<Chauffeur> => {
  const response = await client.patch(`/chauffeurs/${id}`, data);
  return response.data;
};