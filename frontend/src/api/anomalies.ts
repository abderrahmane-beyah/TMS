import client from './client';
import { mockApi } from './mock';
import { USE_MOCK } from './config';

export interface Anomalie {
  id: number;
  tournee_id: number;
  stop_id?: number;
  type: string;
  description: string;
  date: string;
  statut: string;
}

export async function getAnomalies(): Promise<Anomalie[]> {
  if (USE_MOCK) return mockApi.getAnomalies();
  const { data } = await client.get('/anomalies');
  return data;
}

export async function resoudreAnomalie(id: number): Promise<Anomalie> {
  if (USE_MOCK) return mockApi.resoudreAnomalie(id);
  const { data } = await client.patch(`/anomalies/${id}/resoudre`);
  return data;
}
