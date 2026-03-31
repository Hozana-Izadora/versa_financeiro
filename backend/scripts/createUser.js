/**
 * Creates a user and associates them with a client tenant.
 *
 * Usage:
 *   node backend/scripts/createUser.js \
 *     --email user@example.com \
 *     --password "StrongPass123!" \
 *     --name "João Silva" \
 *     --client minha_empresa
 *
 * The --client flag accepts the tenant SLUG (not the UUID).
 * If --client is omitted, the user is created without any client association.
 *
 * Requires DATABASE_URL in backend/.env
 */

import pg from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function run() {
  const args = parseArgs(process.argv);

  const email    = args.email?.toLowerCase().trim();
  const password = args.password;
  const name     = args.name || null;
  const slug     = args.client || null;

  if (!email || !password) {
    console.error('Usage: node createUser.js --email <email> --password <pass> [--name <name>] [--client <slug>]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: password must be at least 8 characters.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check for duplicate email
    const existing = await client.query(
      `SELECT id FROM admin.users WHERE email = $1`, [email]
    );
    if (existing.rowCount > 0) {
      console.error(`Error: user with email "${email}" already exists.`);
      process.exit(1);
    }

    // Hash password
    const hash = await bcrypt.hash(password, 12);

    // Insert user
    const userResult = await client.query(
      `INSERT INTO admin.users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, hash, name]
    );
    const userId = userResult.rows[0].id;

    // Associate with client if provided
    if (slug) {
      const clientResult = await client.query(
        `SELECT id, name FROM admin.clients WHERE slug = $1 AND active = true`,
        [slug]
      );
      if (!clientResult.rowCount) {
        console.error(`Error: client with slug "${slug}" not found or inactive.`);
        console.error('Available clients:');
        const all = await client.query(`SELECT slug, name FROM admin.clients WHERE active = true`);
        all.rows.forEach(r => console.error(`  ${r.slug}  (${r.name})`));
        process.exit(1);
      }

      const clientId = clientResult.rows[0].id;
      await client.query(
        `INSERT INTO admin.client_users (client_id, user_id) VALUES ($1, $2)`,
        [clientId, userId]
      );

      console.log(`\n✓ User created and associated with client "${clientResult.rows[0].name}"`);
    } else {
      console.log('\n✓ User created (no client association — use the DB to assign one)');
    }

    await client.query('COMMIT');

    console.log(`  ID    : ${userId}`);
    console.log(`  Email : ${email}`);
    if (name) console.log(`  Name  : ${name}`);
    if (slug)  console.log(`  Client: ${slug}`);
    console.log('\nUser can now log in at /api/auth/login');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
