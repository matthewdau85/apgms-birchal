import manifests from '../connectors.json';

export interface ConnectorManifest {
  id: string;
  vendor: string;
  product: string;
}

export const connectorManifests: ConnectorManifest[] = manifests;

if (process.env.NODE_ENV !== 'test') {
  console.log('Loaded connectors:', connectorManifests.map((connector) => connector.id).join(', '));
}
