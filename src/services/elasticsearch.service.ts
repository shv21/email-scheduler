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
            deletedAt: { type: 'date' },
          },
        },
      });
      console.log(`✅ [Elasticsearch] Index "${ELASTICSEARCH_INDEX}" successfully created.`);
    } else {
      // Put mapping to update deletedAt property if index already exists
      try {
        await client.indices.putMapping({
          index: ELASTICSEARCH_INDEX,
          properties: {
            deletedAt: { type: 'date' },
          },
        });
      } catch {
        // ignore if already configured
      }
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
  deletedAt?: Date | string | null;
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
      deletedAt: email.deletedAt ? new Date(email.deletedAt).toISOString() : null,
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
 * Updates an indexed email's deletedAt timestamp in Elasticsearch (for soft delete and restore).
 */
export async function updateEmailDeletedAtInIndex(
  id: string,
  deletedAt: Date | string | null
): Promise<boolean> {
  try {
    const client = getElasticsearchClient();

    await client.update({
      index: ELASTICSEARCH_INDEX,
      id,
      doc: {
        deletedAt: deletedAt ? new Date(deletedAt).toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
      doc_as_upsert: false,
    });

    console.log(`🔍 [Elasticsearch] Updated deletedAt for email ${id} to ${deletedAt}`);
    return true;
  } catch (error) {
    console.warn(
      `⚠️ [Elasticsearch] Failed to update deletedAt for email ${id}:`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Permanently removes an email document from the Elasticsearch index.
 */
export async function deleteEmailDocumentFromIndex(id: string): Promise<boolean> {
  try {
    const client = getElasticsearchClient();
    await client.delete({
      index: ELASTICSEARCH_INDEX,
      id,
    });

    console.log(`🗑️ [Elasticsearch] Deleted document for email ${id}`);
    return true;
  } catch (error: any) {
    if (error?.meta?.statusCode === 404 || error?.statusCode === 404) {
      return true; // Already not present
    }
    console.warn(
      `⚠️ [Elasticsearch] Failed to delete email document ${id} from index:`,
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
 * - inTrash (filter only trashed or only active non-deleted emails)
 * - userId isolation (only return emails belonging to user)
 */
export async function searchEmailsInIndex(params: EmailSearchParams): Promise<{
  emails: ScheduledEmail[];
  total: number;
}> {
  const client = getElasticsearchClient();
  const { q, recipient, subject, status, userId, inTrash = false, limit = 20, offset = 0 } = params;

  const mustClauses: Record<string, unknown>[] = [];
  const filterClauses: Record<string, unknown>[] = [];

  // 1. User isolation: User must only see their own scheduled emails
  if (userId) {
    filterClauses.push({
      term: { userId },
    });
  }

  // 2. Trash isolation: Exclude trashed emails from normal search; include ONLY trashed if inTrash = true
  if (inTrash) {
    filterClauses.push({
      exists: { field: 'deletedAt' },
    });
  } else {
    filterClauses.push({
      bool: {
        must_not: {
          exists: { field: 'deletedAt' },
        },
      },
    });
  }

  // 3. Status filter
  if (status) {
    filterClauses.push({
      term: { status },
    });
  }

  // 4. Recipient match (keyword exact or prefix / wildcard)
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

  // 5. Subject match
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

  // 6. Generic multi-match query (q)
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
      deletedAt: doc.deletedAt ? new Date(doc.deletedAt) : null,
    }));

  return {
    emails,
    total: totalValue,
  };
}
