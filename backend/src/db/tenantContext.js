import { pool } from './pool.js';

/**
 * Validates that a schema name is a safe tenant schema identifier.
 * Only allows "tenant_" + lowercase alphanumeric/underscore slug.
 */
function assertSafeSchema(name) {
  if (!/^tenant_[a-z][a-z0-9_]{1,62}$/.test(name)) {
    throw new Error(`Invalid or unsafe tenant schema name: "${name}"`);
  }
}

/**
 * Acquires a pool client with search_path already set to the tenant schema.
 * The schema name is validated before use — never constructed from raw user input.
 *
 * Usage:
 *   const { client, release } = await getTenantClient(req.tenantSchema);
 *   try {
 *     await client.query('SELECT * FROM transactions');
 *   } finally {
 *     release();
 *   }
 */
export async function getTenantClient(tenantSchema) {
  assertSafeSchema(tenantSchema);

  const client = await pool.connect();
  try {
    // Use the validated identifier directly — no user input reaches here.
    await client.query(`SET search_path TO "${tenantSchema}", admin, public`);
  } catch (err) {
    client.release();
    throw err;
  }

  return {
    client,
    release: () => client.release(),
  };
}

/**
 * Convenience wrapper: runs an async callback with a tenant-scoped client,
 * releasing it automatically in a finally block.
 *
 * Usage:
 *   const rows = await withTenant(schema, async (client) => {
 *     const r = await client.query('SELECT * FROM transactions');
 *     return r.rows;
 *   });
 */
export async function withTenant(tenantSchema, fn) {
  const { client, release } = await getTenantClient(tenantSchema);
  try {
    return await fn(client);
  } finally {
    release();
  }
}
