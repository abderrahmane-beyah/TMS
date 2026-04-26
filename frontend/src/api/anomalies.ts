import client from "./client";

export interface Anomalie {
  id: number;
  tournee_id: number;
  stop_id?: number;
  type: string;
  description: string;
  date_signalement: string;
  statut: string;
}

export const getAnomalies = async (statut?: string): Promise<Anomalie[]> => {
  const response = await client.get("/anomalies/", { params: { statut } });
  return response.data;
};

export const createAnomalie = async (data: Partial<Anomalie>): Promise<Anomalie> => {
  const response = await client.post("/anomalies/", data);
  return response.data;
};

export const resoudreAnomalie = async (id: number): Promise<Anomalie> => {
  const response = await client.patch(`/anomalies/${id}/resoudre`);
  return response.data;
};