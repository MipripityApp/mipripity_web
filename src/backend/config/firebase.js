const admin = require("firebase-admin");
require("dotenv").config();

// Firebase configuration for client-side usage
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase Admin SDK - using simpler approach with Google Application Default Credentials
if (!admin.apps.length) {
  try {
    // For deployment on Render, we'll use a simple initialization with just the project ID
    // This works when the Firebase project's public access is enabled for token verification
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
      // Note: For Render deployment, either:
      // 1. Add the GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key
      // 2. Or rely on the simplified token verification which works for many Firebase services
    });

    console.log("Firebase Admin SDK initialized successfully");
    console.log(`Using Firebase project: ${process.env.FIREBASE_PROJECT_ID}`);
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
  }
}

module.exports = {
  admin,
  firebaseConfig,
};