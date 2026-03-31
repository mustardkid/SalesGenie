import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { Salesperson } from '../types';
dotenv.config();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'partsnapp-nv5t1';
  admin.initializeApp({ projectId });
}

export const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// ─── Default Data Seeding ──────────────────────────────────────────

const defaultRoster: Salesperson[] = [
  {
    id: 'rep-001',
    name: 'Sarah Chen',
    strengths: ['Analytical', 'Driver'],
    specialties: ['trucks', 'fleet', 'commercial'],
    currentLoad: 2,
    closeRate: 68,
    available: true,
  },
  {
    id: 'rep-002',
    name: 'Mike Johnson',
    strengths: ['Friendly', 'Expressive'],
    specialties: ['family', 'suv', 'sedans'],
    currentLoad: 1,
    closeRate: 55,
    available: true,
  },
  {
    id: 'rep-003',
    name: 'Jessica Torres',
    strengths: ['Expressive', 'Driver'],
    specialties: ['luxury', 'sports', 'premium'],
    currentLoad: 3,
    closeRate: 72,
    available: true,
  },
  {
    id: 'rep-004',
    name: 'David Park',
    strengths: ['Analytical', 'Friendly'],
    specialties: ['economy', 'hybrid', 'electric'],
    currentLoad: 0,
    closeRate: 61,
    available: true,
  },
];

/**
 * Ensures the roster collection has data.
 * If empty, seeds it with the default roster.
 */
export async function seedRosterIfEmpty() {
  try {
    const snapshot = await db.collection('roster').limit(1).get();
    if (snapshot.empty) {
      console.log('🌱 Seeding initial salesperson roster to Firestore...');
      const batch = db.batch();
      defaultRoster.forEach(rep => {
        const docRef = db.collection('roster').doc(rep.id);
        batch.set(docRef, rep);
      });
      await batch.commit();
      console.log('✅ Roster seeded successfully.');
    }
  } catch (error) {
    console.warn('⚠️ Could not seed roster. Is Firestore enabled?', error);
  }
}
