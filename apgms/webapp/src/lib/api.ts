import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = 'http://localhost:3000';

const createClient = (): AxiosInstance =>
  axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

const client = createClient();

export const getDashboard = async () => {
  const response = await client.get('/dashboard');
  return response.data;
};

export interface BankLinesParams {
  orgId: string;
  take?: number;
  cursor?: string;
}

export const getBankLines = async ({ orgId, take, cursor }: BankLinesParams) => {
  const response = await client.get('/bank-lines', {
    params: {
      orgId,
      take,
      cursor,
    },
  });

  return response.data;
};

export const getRptByLine = async (id: string) => {
  if (!id) {
    throw new Error('A bank line identifier is required to load the report.');
  }

  const response = await client.get(`/bank-lines/${id}/report`);
  return response.data;
};

export default client;
