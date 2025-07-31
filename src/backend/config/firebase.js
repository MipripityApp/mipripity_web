const admin = require("firebase-admin")
require("dotenv").config()

// Firebase configuration for client-side usage
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase Admin SDK using the FIREBASE_CONFIG environment variable
if (!admin.apps.length) {
  try {
    // Parse the FIREBASE_CONFIG JSON string and fix the private key formatting
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG)

    // Fix the private key formatting - replace \\n with actual newlines
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n")
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    })

    console.log("Firebase Admin SDK initialized successfully")
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error)
    console.error("FIREBASE_CONFIG content:", process.env.FIREBASE_CONFIG ? "Present" : "Missing")
  }
}

module.exports = {
  admin,
  firebaseConfig,
}