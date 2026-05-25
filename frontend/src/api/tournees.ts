import client from "./client";

export interface Stop {
  id: number;
  commande_id: number;
  adresse: string;
  lat: number;
  lon: number;
  ordre: number;
  heure_arrivee_prevue?: string;
  heure_arrivee_reelle?: string;
  statut: string;
  commande_statut?: string; // Statut de la commande associée (peut être ANNULEE)
}

export interface Tournee {
  id: number;
  date: string;
  distance_totale?: number;
  progression: number;
  statut: string;
  heure_depart?: string;
  depot_lat?: number;
  depot_lon?: number;
  warehouse_id?: number;
  vehicule_id: number;
  chauffeur_id: number;
  stops?: Stop[];
  created_at: string;
}

export const getTournees = async (): Promise<Tournee[]> => {
  const response = await client.get("/tournees/");
  return response.data;
};

export const getTournee = async (id: number): Promise<Tournee> => {
  const response = await client.get(`/tournees/${id}`);
  return response.data;
};

export const getMaTournee = async (): Promise<Tournee> => {
  const response = await client.get("/tournees/ma-tournee");
  return response.data;
};

export const demarrerTournee = async (id: number): Promise<Tournee> => {
  const response = await client.patch(`/tournees/${id}/demarrer`);
  return response.data;
};

export const terminerTournee = async (id: number): Promise<Tournee> => {
  const response = await client.patch(`/tournees/${id}/terminer`);
  return response.data;
};

export const confirmerLivraison = async (
  tourneeId: number,
  stopId: number
): Promise<Stop> => {
  const response = await client.patch(
    `/tournees/${tourneeId}/stops/${stopId}/confirmer`
  );
  return response.data;
};

export const signalerProbleme = async (
  tourneeId: number,
  stopId: number | null,
  description: string
): Promise<any> => {
  const payload: any = {
    tournee_id: tourneeId,
    type: "SIGNALEMENT_CHAUFFEUR",
    description,
  };
  if (stopId !== null) {
    payload.stop_id = stopId;
  }
  const response = await client.post("/anomalies/", payload);
  return response.data;
};

export interface TourneeUpdatePayload {
  chauffeur_id?: number;
  vehicule_id?: number;
}

export const updateTournee = async (
  id: number,
  data: TourneeUpdatePayload
): Promise<Tournee> => {
  const response = await client.patch(`/tournees/${id}`, data);
  return response.data;
};