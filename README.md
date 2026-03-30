# 🚗 SalesGenie — Agent-Driven VIN Sales Intelligence

> Scan a VIN. Decode the vehicle. Profile the buyer. Match the rep. Close the deal.

SalesGenie is an **agentic AI sales engine** for vehicles with motors. It chains together specialized AI agents — each with a single job — to transform a raw VIN into a buyer-personality-aware sales pitch in under 10 seconds.

---

## Why This Exists

Every dealership has the same problem: a customer walks in, the salesperson wings it, and the pitch lands flat because it was generic. SalesGenie fixes that by:

1. **Decoding** the vehicle from its VIN (NHTSA API) — no manual data entry.
2. **Classifying** the buyer's personality type in real time.
3. **Matching** the buyer to the best salesperson on the floor.
4. **Generating** a tailored pitch that speaks the buyer's language.

The result: higher close rates, shorter sales cycles, and reps who feel like mind readers.

---

## Architecture — The D.O.E. Framework

SalesGenie is built on **D.O.E.**: **Directives → Orchestrator → Execute**.

```
┌──────────────────────────────────────────────────────────────────┐
│                        D.O.E. FRAMEWORK                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │  DIRECTIVES  │───▶│   ORCHESTRATOR   │───▶│    EXECUTE      │  │
│  │  (the WHAT)  │    │   (the HOW)      │    │   (the DO)      │  │
│  └─────────────┘    └──────────────────┘    └────────────────┘  │
│                              │                                   │
│                     ┌────────┴────────┐                          │
│                     ▼                 ▼                          │
│            ┌──────────────┐  ┌──────────────┐                   │
│            │ Agent Router  │  │ Fallback Mgr │                   │
│            └──────┬───────┘  └──────────────┘                   │
│          ┌────────┼────────┬────────┬────────┐                  │
│          ▼        ▼        ▼        ▼        ▼                  │
│     ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐         │
│     │VIN     ││Persona ││Match   ││Pitch   ││Listing │         │
│     │Decoder ││Classif.││Maker   ││Writer  ││Builder │         │
│     └────────┘└────────┘└────────┘└────────┘└────────┘         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

| Layer | Purpose | Doc |
|-------|---------|-----|
| **Directives** | High-level goals the user wants achieved | [DOE/Directives.md](DOE/Directives.md) |
| **Orchestrator** | Decomposes directives into agent tasks, routes, retries | [DOE/Orchestrator.md](DOE/Orchestrator.md) |
| **Execute** | Concrete agent actions — API calls, AI prompts, data transforms | [DOE/Execute.md](DOE/Execute.md) |

---

## Repository Map

```
SalesGenie/
├── README.md                          ← You are here
├── SKILLS.md                          ← Catalog of all discrete skills
├── AGENTS.md                          ← Agent definitions + skill bindings
├── DOE/
│   ├── Directives.md                  ← The "what" — user-facing goals
│   ├── Orchestrator.md                ← The "how" — routing + decision logic
│   └── Execute.md                     ← The "do" — execution patterns
├── pages/
│   ├── skills/
│   │   ├── decode-vin.md              ← Deep dive: NHTSA VIN decoding
│   │   ├── classify-personality.md    ← Deep dive: buyer archetype engine
│   │   ├── match-salesperson.md       ← Deep dive: rep-to-buyer matching
│   │   ├── generate-pitch.md          ← Deep dive: pitch generation
│   │   └── build-listing.md           ← Deep dive: listing builder
│   └── agents/
│       ├── vin-decoder-agent.md       ← VinDecoderAgent spec
│       ├── personality-classifier.md  ← PersonalityClassifierAgent spec
│       ├── sales-matchmaker.md        ← SalesMatchmakerAgent spec
│       ├── sales-pitch-agent.md       ← SalesPitchAgent spec
│       ├── listing-agent.md           ← ListingAgent spec
│       └── orchestrator-agent.md      ← OrchestratorAgent spec
├── src/
│   ├── skills/
│   │   ├── decodeVin.ts               ← NHTSA API integration
│   │   ├── classifyPersonality.ts     ← Buyer personality classifier
│   │   ├── matchSalesperson.ts        ← Salesperson matcher
│   │   ├── generatePitch.ts           ← AI pitch generator
│   │   └── buildListing.ts            ← Listing builder
│   ├── agents/
│   │   ├── VinDecoderAgent.ts         ← Agent wrapper for VIN decode
│   │   ├── PersonalityClassifierAgent.ts
│   │   ├── SalesMatchmakerAgent.ts
│   │   ├── SalesPitchAgent.ts
│   │   ├── ListingAgent.ts
│   │   └── OrchestratorAgent.ts       ← Master orchestrator
│   ├── types.ts                       ← Shared TypeScript interfaces
│   ├── config.ts                      ← Environment + API config
│   └── index.ts                       ← CLI entry point
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Quickstart (5 minutes)

```bash
# 1. Clone
git clone https://github.com/your-org/SalesGenie.git && cd SalesGenie

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env — add your Gemini API key (optional: salesperson roster)

# 4. Run a directive
npx ts-node src/index.ts --vin "3C6UR5FL1KG501234"

# 5. Watch the agents work
#    → VinDecoderAgent decodes the VIN
#    → PersonalityClassifierAgent profiles the buyer
#    → SalesMatchmakerAgent picks the best rep
#    → SalesPitchAgent writes the pitch
#    → You get a complete sales brief in your terminal
```

---

## Key Documents

| Document | What You'll Learn |
|----------|-------------------|
| [SKILLS.md](SKILLS.md) | Every discrete capability the system has |
| [AGENTS.md](AGENTS.md) | How agents are structured and what skills they use |
| [DOE/Directives.md](DOE/Directives.md) | What directives users can issue |
| [DOE/Orchestrator.md](DOE/Orchestrator.md) | How the system decides what to do |
| [DOE/Execute.md](DOE/Execute.md) | Step-by-step execution flows |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ / TypeScript |
| VIN Decode | [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) |
| AI Engine | Google Gemini (`gemini-2.5-flash`) |
| Personality Model | 4-archetype DISC variant (Driver, Analytical, Friendly, Expressive) |
| Deployment | Cloud Run (containerized) or local CLI |

---

## License

MIT — use it, fork it, sell more cars with it.
