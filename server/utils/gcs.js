const fs = require('fs');
const os = require('os');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = 'bldr-mvp-documents-v1';
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCAL_KEY_FILE = path.join(__dirname, '..', '..', 'gcs-credentials.json');
const DECODED_KEY_FILE = path.join(os.tmpdir(), 'gcs-credentials.json');

let bucket;
let resolvedCredentialsPath;

/**
 * Resolve credentials file path for ADC / Storage client.
 * - Railway: GOOGLE_APPLICATION_CREDENTIALS_BASE64 (base64-encoded JSON)
 * - Standard: GOOGLE_APPLICATION_CREDENTIALS (file path)
 * - Local dev: gcs-credentials.json at repo root
 */
function getCredentialsPath() {
  if (resolvedCredentialsPath) {
    return resolvedCredentialsPath;
  }

  const base64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  if (base64) {
    const json = Buffer.from(base64.trim(), 'base64').toString('utf8');
    JSON.parse(json);
    fs.writeFileSync(DECODED_KEY_FILE, json, { encoding: 'utf8', mode: 0o600 });
    resolvedCredentialsPath = DECODED_KEY_FILE;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    resolvedCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  } else if (fs.existsSync(LOCAL_KEY_FILE)) {
    resolvedCredentialsPath = LOCAL_KEY_FILE;
  } else {
    throw new Error(
      'GCS credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS_BASE64 (Railway) ' +
        'or GOOGLE_APPLICATION_CREDENTIALS, or add gcs-credentials.json locally.'
    );
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedCredentialsPath;
  return resolvedCredentialsPath;
}

function createStorageClient() {
  getCredentialsPath();
  return new Storage();
}

/**
 * Upload a buffer to GCS and return a signed read URL (7 days).
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} folder
 * @returns {Promise<string>}
 */
async function uploadToGCS(buffer, filename, folder) {
  if (!bucket) {
    bucket = createStorageClient().bucket(BUCKET_NAME);
  }

  const objectPath = folder ? `${folder.replace(/\/$/, '')}/${filename}` : filename;
  const file = bucket.file(objectPath);

  await file.save(buffer, { resumable: false });

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });

  return signedUrl;
}

module.exports = { uploadToGCS };
