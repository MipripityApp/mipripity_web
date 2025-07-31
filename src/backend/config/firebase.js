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
    // Parse the FIREBASE_CONFIG JSON string
    let serviceAccount

    // Check if FIREBASE_CONFIG is provided as a JSON string
    if (process.env.FIREBASE_CONFIG) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG)
        console.log("Successfully parsed FIREBASE_CONFIG JSON")
      } catch (parseError) {
        console.error("Error parsing FIREBASE_CONFIG JSON:", parseError.message)
        // Fallback to individual environment variables
        serviceAccount = null
      }
    }

    // If JSON parsing failed or FIREBASE_CONFIG not provided, use individual environment variables
    if (!serviceAccount) {
      console.log("Using individual Firebase environment variables")
      serviceAccount = {
        type: process.env.FIREBASE_TYPE || "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
      }
    }

    // Fix the private key formatting - handle different possible formats
    if (serviceAccount.private_key) {
      // If private key is wrapped in quotes, remove them
      if (serviceAccount.private_key.startsWith('"') && serviceAccount.private_key.endsWith('"')) {
        serviceAccount.private_key = serviceAccount.private_key.slice(1, -1)
      }
      
      // Replace \\n with actual newlines
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n")
    } else {
      console.error("Missing private key in Firebase configuration")
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