import { test, expect } from '@playwright/test';

type Endpoint = {
  path: string;
  description: string;
};

const endpoints: Endpoint[] = [
  { path: '/health', description: 'liveness check' },
  { path: '/ready', description: 'readiness check' },
];

for (const endpoint of endpoints) {
  test(`GET ${endpoint.path} returns 200 (${endpoint.description})`, async ({ request }) => {
    const response = await request.get(endpoint.path);
    expect(response.status()).toBe(200);
    expect(response.ok()).toBeTruthy();
  });
}
