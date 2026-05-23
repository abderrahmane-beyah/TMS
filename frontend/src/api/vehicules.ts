import client from "./client";

export interface Vehicule {
  id: number;
  immatriculation: string;
  capacite_poids: number;
  capacite_volume: number;
  type_vehicule: 'normal' | 'refrigere' | 'congelateur';
  ville?: string;
  warehouse_id?: number;
  statut: string;
}

export interface VehiculePayload {
  immatriculation: string;
  capacite_poids: number;
  capacite_volume: number;
  type_vehicule?: 'normal' | 'refrigere' | 'congelateur';
  ville?: string;
  warehouse_id?: number;
  statut?: string;
}

export const getVehicules = async (): Promise<Vehicule[]> => {
  const response = await client.get("/vehicules/");
  return response.data;
};

export const createVehicule = async (data: VehiculePayload): Promise<Vehicule> => {
  const response = await client.post("/vehicules/", data);
  return response.data;
};

export const updateVehicule = async (id: number, data: Partial<VehiculePayload>): Promise<Vehicule> => {
  const response = await client.patch(`/vehicules/${id}`, data);
  return response.data;
};

export const deleteVehicule = async (id: number): Promise<void> => {
  await client.delete(`/vehicules/${id}`);
};