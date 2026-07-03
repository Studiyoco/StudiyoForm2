// GET /api/firebase-test
// Hits Firestore and Storage directly and returns what actually happened.
// Remove this file before going fully public -- it reveals your project config.

const { createSubmission, updateSubmission } = require('./_firebase');

module.exports = async function handler(req, res) {
  const results = {};

  // Test 1: env vars present
  results.envVars = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'MISSING',
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'MISSING',
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
      ? `SET (${process.env.FIREBASE_PRIVATE_KEY.length} chars, starts with: ${process.env.FIREBASE_PRIVATE_KEY.slice(0, 30)})`
      : 'MISSING',
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || 'MISSING'
  };

  // Test 2: actually write a test document
  try {
    const id = await createSubmission({
      company: '__firebase_test__',
      contact: 'Test',
      email: 'test@test.com',
      phone: '0000000',
      website: null,
      product: 'Firebase connectivity test',
      kind: [],
      vibe: [],
      style: null,
      usage: [],
      notes: 'Delete this document'
    });
    results.firestoreWrite = { success: true, documentId: id };

    // Test 3: update it
    await updateSubmission(id, { status: 'test_complete' });
    results.firestoreUpdate = { success: true };
  } catch (e) {
    results.firestoreWrite = { success: false, error: e.message, code: e.code };
  }

  return res.status(200).json(results);
};
