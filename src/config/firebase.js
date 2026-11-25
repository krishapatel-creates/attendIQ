import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Checks whether Firebase keys are present and valid.
 * Enables seamless offline/demo fallback mode when keys are absent.
 * @type {boolean}
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig &&
    typeof firebaseConfig.apiKey === 'string' &&
    firebaseConfig.apiKey.trim().length > 0 &&
    typeof firebaseConfig.projectId === 'string' &&
    firebaseConfig.projectId.trim().length > 0 &&
    firebaseConfig.projectId !== 'remixed-project-id' &&
    typeof firebaseConfig.appId === 'string' &&
    firebaseConfig.appId.trim().length > 0,
);

/** @type {import('firebase/app').FirebaseApp | null} */
let app = null;
/** @type {import('firebase/firestore').Firestore | null} */
let db = null;
/** @type {import('firebase/auth').Auth | null} */
let auth = null;
/** @type {import('firebase/auth').GoogleAuthProvider | null} */
let googleProvider = null;

if (isFirebaseConfigured) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

export async function testFirestoreConnection() {
  if (!isFirebaseConfigured || !db) {
    return { ok: false, offlineFallback: true };
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, offlineFallback: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
      return { ok: false, offlineFallback: true, error: message };
    }
    // Permission denied on synthetic /test/connection doc still confirms live server reachability
    return { ok: true, offlineFallback: false };
  }
}

if (isFirebaseConfigured) {
  void testFirestoreConnection();
}

export { app, db, auth, googleProvider };
