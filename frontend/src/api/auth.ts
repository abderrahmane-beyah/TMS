import client from './client';
import { mockApi } from './mock';
import { USE_MOCK } from './config';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  role: string;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  if (USE_MOCK) return mockApi.login(payload);
  const { data } = await client.post<LoginResponse>('/auth/login', payload);
  return data;
}
