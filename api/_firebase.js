// Firebase Admin SDK -- server-side only, never runs in the browser.
// Initialized once and reused across all Vercel function invocations
// via module-level caching (standard pattern for serverless cold-start
// optimization -- re-initializing on every request is unnecessary and slow).
//
// Required env vars (add these in Vercel Settings -> Environment Variables):
//   FIREBASE_PROJECT_ID    -- from the service account JSON field "project_id"
//   FIREBASE_CLIENT_EMAIL  -- from the service account JSON field "client_email"
//   FIREBASE_PRIVATE_KEY   -- from the service account JSON field "private_key"
//                            (paste the full value including -----BEGIN/END lines
//                             and literal \n characters exactly as they appear)
//   FIREBASE_STORAGE_BUCKET -- your project's storage bucket, typically
//                              "<project-id>.appspot.com" or "<project-id>.firebasestorage.app"

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores env vars as strings -- literal \n from the JSON gets
      // stored as the two-character sequence \\n, which needs to be converted
      // back to a real newline for the RSA key to parse correctly.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();
db.settings({ databaseId: 'studiyoform' });
const bucket = admin.storage().bucket();

// Write the initial submission record the moment the form is submitted,
// before any generation starts. Returns the auto-generated document ID,
// which is threaded through all subsequent pipeline stages so they can
// update the same document rather than create duplicates.
async function createSubmission(form) {
  const doc = await db.collection('submissions').add({
    // Contact fields
    company: form.company || null,
    contact: form.contact || null,
    email: form.email || null,
    phone: form.phone || null,
    website: form.website || null,
    product: form.product || null,
    // Chip selections stored as arrays
    kind: form.kind || [],
    vibe: form.vibe || [],
    style: form.style || null,
    usage: form.usage || [],
    notes: form.notes || null,
    // Pipeline state
    status: 'submitted',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return doc.id;
}

// Update the submission record at each pipeline stage.
// Uses merge: true so partial updates don't overwrite existing fields.
async function updateSubmission(id, data) {
  if (!id) return; // no-op if id is missing -- never throw on storage failures
  try {
    await db.collection('submissions').doc(id).set(
      { ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    // Storage failures are non-fatal -- the pipeline keeps running.
    // Log but don't rethrow.
    console.error('Firestore update failed:', e.message);
  }
}

// Upload a base64-encoded image to Firebase Storage and return its
// permanent public download URL. Path format: submissions/{id}/{filename}
// The file is made publicly readable so the URL works without auth tokens.
async function uploadImage(base64Data, mimeType, submissionId, filename) {
  if (!submissionId) return null;
  try {
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const path = `submissions/${submissionId}/${filename}.${ext}`;
    const file = bucket.file(path);
    const buffer = Buffer.from(base64Data, 'base64');
    await file.save(buffer, {
      metadata: { contentType: mimeType },
      public: true
    });
    // Construct a stable public URL -- no expiry, no signed-URL complexity.
    const encodedPath = encodeURIComponent(path);
    return `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${encodedPath}`;
  } catch (e) {
    console.error('Storage upload failed:', e.message);
    return null; // non-fatal
  }
}

module.exports = { createSubmission, updateSubmission, uploadImage };
