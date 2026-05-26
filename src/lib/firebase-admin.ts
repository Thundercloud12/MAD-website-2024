import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

if (!getApps().length) {
  // 1. Check if the emulator is running locally
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log("🔥 Emulator detected! Initializing Admin SDK in demo mode...");
    initializeApp({
      projectId: "demo-tsec-app",
    });
  } else {
    // 2. Production fallback
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_TSEC_APP) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_TSEC_APP environment variable is not set");
      }
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_TSEC_APP);
      
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("✅ Firebase Admin initialized (Production)");
    } catch (error) {
      console.error("❌ Firebase Admin initialization failed:", error);
      throw new Error("Failed to initialize Firebase Admin");
    }
  }
}

export const dbAdmin = getFirestore();