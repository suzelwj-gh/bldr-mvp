const path = require('path');
const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = 'bldr-mvp-documents-v1';
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCAL_KEY_FILE = path.join(__dirname, '..', '..', 'bldr-mvp-496322-bbb9cc45a212.json');

let bucket;

function createStorageClient() {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentialsJson) {
    return new Storage({ credentials: JSON.parse(credentialsJson.replace(/\\n/g, '\n')) });
  }
  return new Storage({ keyFilename: LOCAL_KEY_FILE });
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
