import client from "./client";

export interface Warehouse {
  id: number;
  nom: string;
  ville: string;
  adresse: string;
  lat: number;
  lon: number;
  heure_ouverture?: string;
  heure_fermeture?: string;
  actif: boolean;
}

export interface WarehouseCreate {
  nom: string;
  ville: string;
  adresse: string;
  lat: number;
  lon: number;
  heure_ouverture?: string;
  heure_fermeture?: string;
}

export const getWarehouses = async (): Promise<Warehouse[]> => {
  const response = await client.get("/warehouses/");
  return response.data;
};

export const getWarehouse = async (id: number): Promise<Warehouse> => {
  const response = await client.get(`/warehouses/${id}`);
  return response.data;
};

export const createWarehouse = async (data: WarehouseCreate): Promise<Warehouse> => {
  const response = await client.post("/warehouses/", data);
  return response.data;
};

export const updateWarehouse = async (id: number, data: Partial<WarehouseCreate>): Promise<Warehouse> => {
  const response = await client.patch(`/warehouses/${id}`, data);
  return response.data;
};

export const deleteWarehouse = async (id: number): Promise<void> => {
  await client.delete(`/warehouses/${id}`);
};
