// ─── SalesGenie Web Server ──────────────────────────────────────────
// Express server serving API endpoints + dashboard

import express from 'express';
import path from 'path';
import cors from 'cors';
import * as dotenv from 'dotenv';
dotenv.config();

import { orchestrate, parseDirective } from './agents/OrchestratorAgent';
import { decodeVin } from './skills/decodeVin';
import { Salesperson, PersonalityType } from './types';
import { db, seedRosterIfEmpty } from './services/db';

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// Initialize DB seeding
seedRosterIfEmpty().catch(console.error);

// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve static dashboard
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ─────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Full pipeline scan
app.post('/api/scan', async (req, res) => {
  try {
    const { vin, personality, directive: rawDirective, includeMatch, includeListing } = req.body;

    // Fetch current roster from DB
    const rosterSnapshot = await db.collection('roster').get();
    const roster: Salesperson[] = rosterSnapshot.docs.map(doc => doc.data() as Salesperson);

    let directive: string;
    if (rawDirective) {
      directive = rawDirective;
    } else if (vin) {
      directive = `Scan VIN ${vin}`;
      if (personality) directive += ` for a ${personality} buyer`;
      if (includeMatch !== false) directive += ' with match';
      if (includeListing) directive += ' and build a listing';
      directive += ' and generate a sales brief';
    } else {
      return res.status(400).json({ error: 'VIN or directive is required' });
    }

    const brief = await orchestrate({ directive, roster });

    // Transform for dashboard consumption
    const response: Record<string, any> = {
      directive: brief.directive,
      vehicle: brief.vehicle,
      buyerProfile: brief.buyerProfile,
      pitch: brief.pitch,
      listing: brief.listing,
      metadata: brief.metadata,
    };

    // Flatten salesperson match for dashboard
    if (brief.salespersonMatch) {
      response.salespersonMatch = {
        salesperson: brief.salespersonMatch.recommended.name,
        score: brief.salespersonMatch.matchScore,
        reason: brief.salespersonMatch.reason,
        handoffScript: brief.salespersonMatch.handoffScript,
        alternates: brief.salespersonMatch.alternates.map(a => a.name),
      };
    }

    // Save scan to history
    await db.collection('history').add({
      ...response,
      createdAt: new Date().toISOString()
    });

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// VIN decode only
app.post('/api/decode', async (req, res) => {
  try {
    const { vin } = req.body;
    if (!vin) {
      return res.status(400).json({ error: 'VIN is required' });
    }
    const vehicleData = await decodeVin(vin);
    res.json(vehicleData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Roster management
app.get('/api/roster', async (_req, res) => {
  try {
    const snapshot = await db.collection('roster').get();
    const currentRoster = snapshot.docs.map(doc => doc.data());
    res.json(currentRoster);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roster' });
  }
});

app.put('/api/roster', async (req, res) => {
  try {
    const updatedRoster = req.body;
    if (!Array.isArray(updatedRoster)) {
      return res.status(400).json({ error: 'Expected array of salespersons' });
    }
    const batch = db.batch();
    updatedRoster.forEach(rep => {
      const docRef = db.collection('roster').doc(rep.id);
      batch.set(docRef, rep);
    });
    await batch.commit();
    res.json({ success: true, count: updatedRoster.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Update single rep
app.put('/api/roster/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('roster').doc(id);
    await docRef.set(req.body, { merge: true });
    const updated = await docRef.get();
    res.json(updated.data());
  } catch (error) {
    res.status(500).json({ error: 'Failed to update rep' });
  }
});

// Add rep
app.post('/api/roster', async (req, res) => {
  try {
    const snapshot = await db.collection('roster').get();
    const newRep: Salesperson = {
      id: `rep-${String(snapshot.size + 1).padStart(3, '0')}`,
      ...req.body,
    };
    await db.collection('roster').doc(newRep.id).set(newRep);
    res.status(201).json(newRep);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add rep' });
  }
});

// Delete rep
app.delete('/api/roster/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('roster').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete rep' });
  }
});

// History endpoint
app.get('/api/history', async (_req, res) => {
  try {
    const snapshot = await db.collection('history').orderBy('createdAt', 'desc').limit(50).get();
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// SPA fallback — serve dashboard for all other routes
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚗 SalesGenie Server running on http://localhost:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   API:       http://localhost:${PORT}/api/health`);
  console.log(`   Gemini:    ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing GEMINI_API_KEY'}\n`);
});
