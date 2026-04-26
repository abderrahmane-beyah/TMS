import client from "./client";

export interface User {
  id: number;
  nom: string;
  email: string;
  telephone?: string;
  role: string;
  actif: boolean;
}

export interface UserPayload {
  nom: string;
  email: string;
  mot_de_passe?: string;
  telephone?: string;
  role: string;
}

export const getUsers = async (): Promise<User[]> => {
  const response = await client.get("/admin/users");
  return response.data;
};

export const createUser = async (data: UserPayload): Promise<User> => {
  const response = await client.post("/admin/users", data);
  return response.data;
};

export const updateUser = async (id: number, data: Partial<UserPayload>): Promise<User> => {
  const response = await client.patch(`/admin/users/${id}`, data);
  return response.data;
};

export const toggleActif = async (id: number): Promise<User> => {
  const response = await client.patch(`/admin/users/${id}/toggle-actif`);
  return response.data;
};