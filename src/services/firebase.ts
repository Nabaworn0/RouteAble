import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getAuth, initializeAuth, onAuthStateChanged, signInAnonymously, type Auth, type Persistence, type User } from 'firebase/auth';
import { collection, deleteDoc, doc, getFirestore, initializeFirestore, onSnapshot, serverTimestamp, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore';
import type { CampusMarker } from '../data/access-points';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every((value) => typeof value === 'string' && value.length > 0);

const app = isFirebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
const getReactNativePersistence = (FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
}).getReactNativePersistence;

function createAuth(): Auth | null {
  if (!app) return null;
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
}

const auth = createAuth();

function createDatabase(): Firestore | null {
  if (!app) return null;
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
}

const database = createDatabase();

async function waitForCurrentUser(): Promise<User | null> {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          stop();
          resolve(user);
          return;
        }
        try {
          const credential = await signInAnonymously(auth);
          stop();
          resolve(credential.user);
        } catch (error) {
          stop();
          reject(error);
        }
      },
      reject,
    );
  });
}

export async function connectFirebase(): Promise<string | null> {
  const user = await waitForCurrentUser();
  return user?.uid ?? null;
}

export function subscribeToSharedMarkers(
  onMarkers: (markers: unknown[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  if (!database) return () => undefined;
  return onSnapshot(
    collection(database, 'accessibilityPoints'),
    (snapshot) => onMarkers(snapshot.docs.map((snapshotDocument) => ({ id: snapshotDocument.id, ...snapshotDocument.data() }))),
    onError,
  );
}

export async function saveSharedMarker(marker: CampusMarker): Promise<string | null> {
  if (!database) return null;
  const user = await waitForCurrentUser();
  if (!user) return null;

  await setDoc(doc(database, 'accessibilityPoints', marker.id), {
    category: marker.category,
    kind: marker.kind,
    title: marker.title,
    location: marker.location,
    coordinate: marker.coordinate,
    status: marker.status,
    description: marker.description,
    color: marker.color,
    symbol: marker.symbol,
    sourceLabel: 'RouteAble community survey',
    sourceUrl: '',
    ownerId: marker.ownerId ?? user.uid,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
  return user.uid;
}

export async function deleteSharedMarker(markerId: string): Promise<void> {
  if (!database) return;
  await waitForCurrentUser();
  await deleteDoc(doc(database, 'accessibilityPoints', markerId));
}
