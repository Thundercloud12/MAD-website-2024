import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {

  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "http://127.0.0.1:9000/?ns=demo-project",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:1234567890",
};

// Initialize App and Services
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// 🚀 Reroute to Local Emulators in Development Mode
if (process.env.NODE_ENV === "development") {
  console.log("🔥 Next.js Frontend connecting to local Firebase emulators...");
  
  try {
    // connectAuthEmulator explicitly uses http://127.0.0.1 to avoid CORS/Cookie issues
    connectAuthEmulator(auth, "http://127.0.0.1:9098", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8081);
    // connectStorageEmulator(storage, "127.0.0.1", 9199); 
  } catch (error) {
    
    console.log("ℹ️ Firebase Emulators already connected.");
  }
}

export { db, app, auth, storage };