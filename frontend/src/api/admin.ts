import client from './client';
import { mockApi } from './mock';
import { USE_MOCK } from './config';

export interface User {
  id: number;
  email: string;
  nom: string;
  role: string;
  actif: boolean;
}

export interface UserPayload {
  email: string;
  nom: string;
  role: string;
  password?: string;
  actif?: boolean;
}

export async function getUsers(): Promise<User[]> {
  if (USE_MOCK) return mockApi.getUsers();
  const { data } = await client.get('/admin/users');
  return data;
}

export async function createUser(payload: UserPayload): Promise<User> {
  if (USE_MOCK) return mockApi.createUser(payload);
  const { data } = await client.post('/admin/users', payload);
  return data;
}

export async function updateUser(
  id: number,
  payload: Partial<UserPayload>
): Promise<User> {
  if (USE_MOCK) return mockApi.updateUser(id, payload);
  const { data } = await client.patch(`/admin/users/${id}`, payload);
  return data;
}
