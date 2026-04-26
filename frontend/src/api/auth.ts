import client from "./client";

export interface LoginPayload {
  email: string;
  password: string;
}

export const login = async (payload: LoginPayload) => {
  const response = await client.post("/auth/login", payload);
  return response.data;
};