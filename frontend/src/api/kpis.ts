import client from './client';
import { mockApi } from './mock';
import { USE_MOCK } from './config';

export interface OtdData {
  date: string;
  taux: number;
}

export interface UtilisationData {
  vehicule: string;
  taux: number;
}

export interface CoutParKmData {
  date: string;
  cout: number;
}

export interface NonServiesData {
  date: string;
  count: number;
}

export async function getOtd(): Promise<OtdData[]> {
  if (USE_MOCK) return mockApi.getOtd();
  const { data } = await client.get('/kpis/otd');
  return data;
}

export async function getUtilisation(): Promise<UtilisationData[]> {
  if (USE_MOCK) return mockApi.getUtilisation();
  const { data } = await client.get('/kpis/utilisation');
  return data;
}

export async function getCoutParKm(): Promise<CoutParKmData[]> {
  if (USE_MOCK) return mockApi.getCoutParKm();
  const { data } = await client.get('/kpis/cout-par-km');
  return data;
}

export async function getNonServies(): Promise<NonServiesData[]> {
  if (USE_MOCK) return mockApi.getNonServies();
  const { data } = await client.get('/kpis/non-servies');
  return data;
}
