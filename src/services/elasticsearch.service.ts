import { getElasticsearchClient, ELASTICSEARCH_INDEX } from '../config/elasticsearch';
import { EmailDocument, EmailSearchParams, EmailStatusType, ScheduledEmail } from '../types/email.types';

/**
 * Ensures the Elasticsearch index exists with the appropriate mapping.
 * Does not throw; returns boolean indicating success.
 */
export async function initElasticsearchIndex(): Promise<boolean> {
  try {
    const client = getElasticsearchClient();
    const exists = await client.indices.exists({ index: ELASTICSEARCH_INDEX });

    if (!exists) {
      console.log(`🔍 [Elasticsearch] Index "${ELASTICSEARCH_INDEX}" does not exist. Creating with mappings...`);
      await client.indices.create({
        index: ELASTICSEARCH_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            sender: { type: 'keyword' },
            recipient: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            subject: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      });
      console.log(`✅ [Elasticsearch] Index "${ELASTICSEARCH_INDEX}" successfully created.`);
    }

    return true;
  } catch (error) {
    console.warn(
      `⚠️ [Elasticsearch] Could not initialize index "${ELASTICSEARCH_INDEX}":`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Indexes an email document in Elasticsearch.
 * PostgreSQL remains the source of truth; any Elasticsearch failure is logged
 * and will not fail or corrupt the database transaction.
 */
export async function indexEmailDocument(email: {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date | string;
  status: EmailStatusType;
  createdAt: Date | string;
  updatedAt?: Date | string;
  userId?: string | null;
}): Promise<boolean> {
  try {
    const client = getElasticsearchClient();

    const doc: EmailDocument = {
      id: email.id,
      userId: email.userId || null,
      sender: email.sender,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: new Date(email.scheduledAt).toISOString(),
      createdAt: new Date(email.createdAt).toISOString(),
      updatedAt: new Date(email.updatedAt || email.createdAt).toISOString(),
    };

    await client.index({
      index: ELASTICSEARCH_INDEX,
      id: email.id,
      document: doc,
    });

    console.log(`🔍 [Elasticsearch] Successfully indexed email ${email.id} (Status: ${email.status})`);
    return true;
  } catch (error) {
    console.warn(
      `⚠️ [Elasticsearch] Failed to index email ${email.id} (non-fatal, PostgreSQL is primary):`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Updates an indexed email's status (and optionally other fields like scheduledAt) in Elasticsearch.
 * PostgreSQL remains the source of truth; any Elasticsearch failure is logged and does not fail worker.
 */
export async function updateEmailStatusInIndex(
  id: string,
  status: EmailStatusType,
  additionalFields: {
    scheduledAt?: Date | string;
    updatedAt?: Date | string;
  } = {}
): Promise<boolean> {
  try {
    const client = getElasticsearchClient();

    const docUpdate: Record<string, unknown> = {
      status,
      updatedAt: new Date(additionalFields.updatedAt || Date.now()).toISOString(),
    };

    if (additionalFields.scheduledAt) {
      docUpdate.scheduledAt = new Date(additionalFields.scheduledAt).toISOString();
    }

    await client.update({
      index: ELASTICSEARCH_INDEX,
      id,
      doc: docUpdate,
      doc_as_upsert: false,
    });

    console.log(`🔍 [Elasticsearch] Updated status of email ${id} to "${status}"`);
    return true;
  } catch (error) {
    console.warn(
      `⚠️ [Elasticsearch] Failed to update email ${id} status in index (non-fatal):`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Searches Elasticsearch index using structured bool queries.
 * Supports:
 * - recipient (text prefix / keyword match)
 * - subject (full text match with fuzziness)
 * - status (exact keyword match)
 * - q (multi-match across subject, recipient, body)
 * - userId isolation (only return emails belonging to user)
 */
export async function searchEmailsInIndex(params: EmailSearchParams): Promise<{
  emails: ScheduledEmail[];
  total: number;
}> {
  const client = getElasticsearchClient();
  const { q, recipient, subject, status, userId, limit = 20, offset = 0 } = params;

  const mustClauses: Record<string, unknown>[] = [];
  const filterClauses: Record<string, unknown>[] = [];

  // 1. User isolation: User must only see their own scheduled emails
  if (userId) {
    filterClauses.push({
      term: { userId },
    });
  }

  // 2. Status filter
  if (status) {
    filterClauses.push({
      term: { status },
    });
  }

  // 3. Recipient match (keyword exact or prefix / wildcard)
  if (recipient) {
    const cleanRecipient = recipient.trim();
    mustClauses.push({
      bool: {
        should: [
          { term: { 'recipient.keyword': cleanRecipient } },
          { match_phrase_prefix: { recipient: cleanRecipient } },
          { wildcard: { 'recipient.keyword': `*${cleanRecipient.toLowerCase()}*` } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  // 4. Subject match
  if (subject) {
    mustClauses.push({
      match: {
        subject: {
          query: subject.trim(),
          fuzziness: 'AUTO',
        },
      },
    });
  }

  // 5. Generic multi-match query (q)
  if (q) {
    mustClauses.push({
      multi_match: {
        query: q.trim(),
        fields: ['subject^3', 'recipient^2', 'body'],
        fuzziness: 'AUTO',
      },
    });
  }

  // If no search text provided, match all in filter
  if (mustClauses.length === 0) {
    mustClauses.push({ match_all: {} });
  }

  const query = {
    bool: {
      must: mustClauses,
      filter: filterClauses,
    },
  };

  const response = await client.search<EmailDocument>({
    index: ELASTICSEARCH_INDEX,
    from: offset,
    size: limit,
    query,
    sort: [
      { _score: { order: 'desc' } },
      { scheduledAt: { order: 'desc' } },
    ],
  });

  const hits = response.hits.hits;
  const totalValue =
    typeof response.hits.total === 'number'
      ? response.hits.total
      : response.hits.total?.value || hits.length;

  const emails: ScheduledEmail[] = hits
    .map((hit) => hit._source)
    .filter((source): source is EmailDocument => Boolean(source))
    .map((doc) => ({
      id: doc.id,
      userId: doc.userId,
      sender: doc.sender,
      recipient: doc.recipient,
      subject: doc.subject,
      body: doc.body,
      status: doc.status,
      scheduledAt: new Date(doc.scheduledAt),
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
    }));

  return {
    emails,
    total: totalValue,
  };
}
