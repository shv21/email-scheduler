import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

export const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'emails';

let esClient: Client | null = null;

/**
 * Returns a singleton Elasticsearch Client configured from environment variables.
 * Never hardcodes credentials.
 */
export function getElasticsearchClient(): Client {
  if (esClient) return esClient;

  const node = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  const username = process.env.ELASTICSEARCH_USERNAME;
  const password = process.env.ELASTICSEARCH_PASSWORD;

  const clientOptions: Record<string, unknown> = {
    node,
    maxRetries: 2,
    requestTimeout: 4000,
  };

  if (apiKey) {
    clientOptions.auth = { apiKey };
  } else if (username && password) {
    clientOptions.auth = { username, password };
  }

  esClient = new Client(clientOptions);
  return esClient;
}

/**
 * Tests connection to Elasticsearch cluster.
 * Returns true if cluster responds to ping, false otherwise.
 */
export async function checkElasticsearchHealth(): Promise<boolean> {
  try {
    const client = getElasticsearchClient();
    const isAlive = await client.ping();
    return Boolean(isAlive);
  } catch (err) {
    return false;
  }
}

/**
 * Closes the Elasticsearch client connection (used during graceful shutdown or tests).
 */
export async function closeElasticsearchClient(): Promise<void> {
  if (esClient) {
    try {
      await esClient.close();
    } catch {
      // ignore close errors
    } finally {
      esClient = null;
    }
  }
}
