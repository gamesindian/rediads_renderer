#!/usr/bin/env node
/**
 * Upload built renderer assets to Cloudflare R2 and purge CDN URLs.
 * Paths match cdn.rediads.com (helper/* video bundle, native/v1/* native bundle).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(rootDir, 'dist');
const envFile = join(rootDir, '.env');

function loadEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=');
        if (i === -1) return null;
        return [line.slice(0, i), line.slice(i + 1)];
      })
      .filter(Boolean),
  );
}

const env = { ...process.env, ...loadEnv(envFile) };
const { version } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const cdnBase = (env.CDN_BASE_URL || 'https://cdn.rediads.com').replace(/\/$/, '');

/** @type {{ file: string, key: string, contentType: string, cdnPath: string }[]} */
const artifacts = [
  {
    file: 'rediads-renderer.umd.cjs',
    key: 'helper/rediads-renderer.umd.cjs',
    contentType: 'application/javascript; charset=utf-8',
    cdnPath: '/helper/rediads-renderer.umd.cjs',
  },
  {
    file: 'rediads-renderer.js',
    key: 'helper/rediads-renderer.js',
    contentType: 'application/javascript; charset=utf-8',
    cdnPath: '/helper/rediads-renderer.js',
  },
  {
    file: 'rediads-renderer.css',
    key: 'helper/rediads-renderer.css',
    contentType: 'text/css; charset=utf-8',
    cdnPath: '/helper/rediads-renderer.css',
  },
  {
    file: 'rediads-native-renderer.js',
    key: 'native/v1/rediads-native-renderer.js',
    contentType: 'application/javascript; charset=utf-8',
    cdnPath: '/native/v1/rediads-native-renderer.js',
  },
];

const mapFiles = [
  ['rediads-renderer.umd.cjs.map', 'helper/rediads-renderer.umd.cjs.map'],
  ['rediads-renderer.js.map', 'helper/rediads-renderer.js.map'],
  ['rediads-native-renderer.js.map', 'native/v1/rediads-native-renderer.js.map'],
];

const required = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'CLOUDFLARE_ZONE_ID',
  'CLOUDFLARE_API_TOKEN',
];

for (const key of required) {
  if (!env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const cacheControl = 'public, max-age=300';

async function put(key, body, contentType) {
  console.log(`Uploading s3://${env.R2_BUCKET}/${key}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

for (const a of artifacts) {
  const source = join(distDir, a.file);
  if (!existsSync(source)) {
    console.error(`Missing build output: ${source}. Run npm run build first.`);
    process.exit(1);
  }
  await put(a.key, readFileSync(source), a.contentType);
  const versionedKey = a.key.replace(/^(helper|native\/v1)\//, `$1/${version}/`);
  if (versionedKey !== a.key) {
    await put(versionedKey, readFileSync(source), a.contentType);
  }
}

for (const [file, key] of mapFiles) {
  const source = join(distDir, file);
  if (!existsSync(source)) continue;
  await put(key, readFileSync(source), 'application/json');
}

const purgeUrls = artifacts.map((a) => `${cdnBase}${a.cdnPath}`);
console.log(`Purging Cloudflare cache for ${purgeUrls.length} URL(s)...`);

/** API token (Bearer) or Global API Key (X-Auth-Email + X-Auth-Key), same as rediwrap. */
const purgeHeaders = { 'Content-Type': 'application/json' };
if (env.CLOUDFLARE_AUTH_EMAIL) {
  purgeHeaders['X-Auth-Email'] = env.CLOUDFLARE_AUTH_EMAIL;
  purgeHeaders['X-Auth-Key'] = env.CLOUDFLARE_API_TOKEN;
} else {
  purgeHeaders.Authorization = `Bearer ${env.CLOUDFLARE_API_TOKEN}`;
}

const purgeResponse = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`,
  {
    method: 'POST',
    headers: purgeHeaders,
    body: JSON.stringify({ files: purgeUrls }),
  },
);

const purgeResult = await purgeResponse.json();
if (!purgeResponse.ok || !purgeResult.success) {
  console.warn('Cache purge failed (R2 upload succeeded):', JSON.stringify(purgeResult));
  console.warn(
    'Fix CLOUDFLARE_API_TOKEN (Cache Purge) or set CLOUDFLARE_AUTH_EMAIL with a Global API Key.',
  );
} else {
  console.log('CDN cache purged.');
}

console.log('Deploy complete.');
for (const url of purgeUrls) console.log(`  ${url}`);
