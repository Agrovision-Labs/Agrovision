import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword, // <-- NEW
  signInWithEmailAndPassword,      // <-- NEW
  updateProfile                  // <-- NEW
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";

// --- 1. GET FIREBASE CONFIG FROM .env FILE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey) {
  console.error("CRITICAL: Firebase config is missing. Make sure .env file is set up correctly with VITE_ prefixed variables.");
}

// --- 2. INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- 3. HELPER FUNCTION TO SAVE USER TO BACKEND ---
// We make this reusable
const saveUserToBackend = async (user) => {
  try {
    await fetch('https://agrovision-backend-ai7k.onrender.com/save_user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName, // Will be null for new email signups
        photoURL: user.photoURL,     // Will be null
      }),
    });
  } catch (error) {
    console.error("Failed to save user to backend:", error);
  }
};

// --- 4. AUTH FUNCTIONS ---

const googleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    await saveUserToBackend(user); // Save to backend
    return user;
  } catch (error) {
    console.error("Google login failed:", error);
    return { error }; // Return error object
  }
};

const emailSignUp = async (email, password) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    
    // Set a default display name from the email
    const defaultName = email.split('@')[0];
    await updateProfile(user, { displayName: defaultName });

    // Save to backend (user.displayName will be the defaultName)
    await saveUserToBackend({ ...user, displayName: defaultName }); 
    
    return user;
  } catch (error) {
    console.error("Email signup failed:", error);
    return { error }; // Return error object
  }
};

const emailLogin = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Email login failed:", error);
    return { error }; // Return error object
  }
};

const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
  }
};

// --- 5. EXPORTS ---
export {
  auth,
  db,
  googleLogin,
  emailSignUp, // <-- NEW
  emailLogin,  // <-- NEW
  logout,
  onAuthStateChanged
};