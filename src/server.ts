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

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve static dashboard
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── In-Memory Roster (editable via API) ─────────────────────────────
let roster: Salesperson[] = [
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
app.get('/api/roster', (_req, res) => {
  res.json(roster);
});

app.put('/api/roster', (req, res) => {
  try {
    const updatedRoster = req.body;
    if (!Array.isArray(updatedRoster)) {
      return res.status(400).json({ error: 'Expected array of salespersons' });
    }
    roster = updatedRoster;
    res.json({ success: true, count: roster.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Update single rep
app.put('/api/roster/:id', (req, res) => {
  const { id } = req.params;
  const index = roster.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: `Rep ${id} not found` });
  }
  roster[index] = { ...roster[index], ...req.body };
  res.json(roster[index]);
});

// Add rep
app.post('/api/roster', (req, res) => {
  const newRep: Salesperson = {
    id: `rep-${String(roster.length + 1).padStart(3, '0')}`,
    ...req.body,
  };
  roster.push(newRep);
  res.status(201).json(newRep);
});

// Delete rep
app.delete('/api/roster/:id', (req, res) => {
  const { id } = req.params;
  const index = roster.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: `Rep ${id} not found` });
  }
  roster.splice(index, 1);
  res.json({ success: true });
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
