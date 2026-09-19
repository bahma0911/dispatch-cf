import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const databaseName = process.env.MONGODB_DB_NAME || 'nega';
const mongoUri = process.env.MONGODB_URI;
const databaseNameForWrangler = process.env.D1_DATABASE_NAME || 'dispatch-cf';
const temporaryDirectory = '.migration-tmp';
const sqlFile = join(temporaryDirectory, 'mongodb-to-d1.sql');
const collections = [
  'users',
  'customers',
  'drivers',
  'orders',
  'commissionSettlements'
];

if (!mongoUri) {
  throw new Error('MONGODB_URI is not configured in .env');
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalize(value) {
  if (value && typeof value === 'object' && value._bsontype === 'ObjectId') {
    return value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

function recordId(document) {
  const normalizedId = normalize(document._id);
  return normalizedId ? String(normalizedId) : crypto.randomUUID();
}

const client = new MongoClient(mongoUri);
mkdirSync(temporaryDirectory, { recursive: true });

try {
  await client.connect();
  const database = client.db(databaseName);
  const statements = [];

  for (const collectionName of collections) {
    const documents = await database.collection(collectionName).find({}).toArray();
    for (const document of documents) {
      const normalized = normalize(document);
      const id = recordId(document);
      const createdAt = normalized.createdAt || normalized.timestamp || new Date().toISOString();
      statements.push(
        `INSERT OR REPLACE INTO records (collection, id, data, created_at) VALUES (${sqlString(collectionName)}, ${sqlString(id)}, ${sqlString(JSON.stringify(normalized))}, ${sqlString(createdAt)});`
      );
    }
    console.log(`${collectionName}: ${documents.length} document(s)`);
  }

  writeFileSync(sqlFile, `${statements.join('\n')}\n`, 'utf8');
  console.log(`Executing migration against D1 database: ${databaseNameForWrangler}`);
  execFileSync('npx', ['wrangler', 'd1', 'execute', databaseNameForWrangler, '--remote', `--file=${sqlFile}`], { stdio: 'inherit' });
  console.log('MongoDB to D1 migration completed.');
} finally {
  await client.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
