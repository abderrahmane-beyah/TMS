import client from "./client";

export const getOtd = async () => {
  const response = await client.get("/kpis/otd");
  return response.data;
};

export const getUtilisation = async () => {
  const response = await client.get("/kpis/utilisation");
  return response.data;
};

export const getNonServies = async () => {
  const response = await client.get("/kpis/non-servies");
  return response.data;
};