# 🧠 Skill Deep Dive: `classifyPersonalitySkill`

> Profile a vehicle buyer into one of four personality archetypes using conversational Q&A and behavioral cues.

---

## The DISC Model (Simplified for Sales)

Our personality classification is based on a simplified DISC framework optimized for automotive sales:

```
                 FAST-PACED / ASSERTIVE
                         │
            ┌────────────┼────────────┐
            │                         │
     TASK   │   🔴 DRIVER    🟡 EXPRESSIVE   │   PEOPLE
   ORIENTED │                         │   ORIENTED
            │   🔵 ANALYTICAL  🟢 FRIENDLY    │
            │                         │
            └────────────┼────────────┘
                         │
               METHODICAL / PATIENT
```

---

## Archetype Definitions

### 🔴 Driver (Dominant)

**Core trait**: "I want results, fast."

| Attribute | Detail |
|-----------|--------|
| Decision speed | Fastest — decides in minutes, not days |
| Information need | Headlines only — skip the details |
| Trust trigger | Competence and confidence |
| Buying fear | Missing a better deal / losing control |
| Ideal pitch style | Direct, commanding, competitive |
| Example quotes | "What's your best price?", "I don't have all day" |

**Communication Rules**:
- ✅ Be direct and concise
- ✅ Emphasize "best in class", "fastest", "most powerful"
- ✅ Let them feel in control of the process
- ❌ Don't ramble or tell long stories
- ❌ Don't be overly friendly — they'll see it as weakness
- ❌ Don't present too many options — they want THE answer

---

### 🔵 Analytical (Conscientious)

**Core trait**: "Show me the data."

| Attribute | Detail |
|-----------|--------|
| Decision speed | Slowest — needs to research and compare |
| Information need | Maximum — specs, reviews, TCO analysis |
| Trust trigger | Facts, data, third-party validation |
| Buying fear | Making a mistake / overpaying |
| Ideal pitch style | Data-rich, comparative, logical |
| Example quotes | "What's the reliability rating?", "How does it compare to the F-350?" |

**Communication Rules**:
- ✅ Lead with specifications and numbers
- ✅ Provide competitor comparisons
- ✅ Reference Consumer Reports, J.D. Power, KBB
- ❌ Don't rush them — they need time
- ❌ Don't use emotional appeals
- ❌ Don't dismiss their questions as "overthinking"

---

### 🟢 Friendly (Steady)

**Core trait**: "I want to feel good about this."

| Attribute | Detail |
|-----------|--------|
| Decision speed | Moderate — needs spouse/family input |
| Information need | Moderate — focused on comfort & safety |
| Trust trigger | Personal connection and honesty |
| Buying fear | Conflict, buyer's remorse, feeling pressured |
| Ideal pitch style | Warm, narrative, reassuring |
| Example quotes | "My husband will need to see this", "Is this safe for my kids?" |

**Communication Rules**:
- ✅ Build a genuine personal connection first
- ✅ Emphasize safety ratings, warranty, family features
- ✅ Be patient — they may need multiple visits
- ❌ Don't be pushy or create urgency
- ❌ Don't overwhelm with technical specs
- ❌ Don't separate them from their decision partner

---

### 🟡 Expressive (Influential)

**Core trait**: "Make me feel something."

| Attribute | Detail |
|-----------|--------|
| Decision speed | Fast — impulse-driven |
| Information need | Low for specs, high for story/lifestyle |
| Trust trigger | Excitement, exclusivity, social proof |
| Buying fear | Missing out on something cool |
| Ideal pitch style | Exciting, visual, aspirational |
| Example quotes | "Does it come in that blue?", "My friends are going to love this" |

**Communication Rules**:
- ✅ Paint a picture: "Imagine pulling up to..."
- ✅ Emphasize unique features, colors, lifestyle fit
- ✅ Use social proof: "This is the most popular trim right now"
- ❌ Don't bore them with spreadsheets
- ❌ Don't be monotone or read from a spec sheet
- ❌ Don't talk too much about gas mileage or depreciation

---

## Classification Questions

### Default Question Set (asked by salesperson)

| # | Question | What it reveals |
|---|----------|----------------|
| 1 | "What's the most important thing you're looking for?" | Primary motivator: performance (Driver), data (Analytical), comfort (Friendly), style (Expressive) |
| 2 | "How do you usually make big purchase decisions?" | Decision process: fast/alone (Driver), research (Analytical), family (Friendly), gut/impulse (Expressive) |
| 3 | "What do you love or hate about your current vehicle?" | Values: power/speed (D), reliability/efficiency (A), comfort/safety (F), looks/fun (E) |
| 4 | "Who else is involved in this decision?" | Independence level: just me (D/E), need data (A), spouse/family (F) |
| 5 | "What would make you drive off the lot today?" | Close trigger: best deal (D), right numbers (A), right feeling (F), right vibe (E) |

### Keyword Scoring Matrix

| Keyword / Phrase | Driver | Analytical | Friendly | Expressive |
|------------------|--------|------------|----------|------------|
| "power", "fastest", "best" | +3 | | | |
| "reliable", "efficient", "ratings" | | +3 | | |
| "safe", "family", "comfortable" | | | +3 | |
| "cool", "unique", "color" | | | | +3 |
| "bottom line", "deal" | +2 | +1 | | |
| "research", "compare" | | +3 | | |
| "my kids", "my wife/husband" | | | +3 | |
| "imagine", "dream" | | | | +3 |
| "hurry", "today" | +2 | | | +1 |

---

## Follow-Up Question Logic

If initial classification confidence is below 60%, the agent generates a targeted follow-up:

```typescript
function generateFollowUp(ambiguousTypes: string[]): string {
  const followUps: Record<string, string> = {
    'Driver-Analytical': 'If you could only pick one — raw performance or proven reliability — which wins?',
    'Driver-Expressive': 'Are you drawn to a vehicle because it\'s the most powerful, or because it turns heads?',
    'Analytical-Friendly': 'When choosing between the safest option and the best-rated option, which pulls you more?',
    'Friendly-Expressive': 'Is it more important that your family loves it, or that you love looking at it?',
    'Driver-Friendly': 'Do you prioritize getting things done, or making sure everyone is comfortable?',
    'Analytical-Expressive': 'Do you trust the numbers, or do you trust your gut?',
  };
  
  const key = ambiguousTypes.sort().join('-');
  return followUps[key] || 'What would make this the perfect vehicle for you?';
}
```

---

## Gemini Prompt Engineering

The classifyPersonalitySkill uses a carefully engineered prompt:

```
SYSTEM:
You are a sales psychology expert trained in the DISC personality model, 
specialized for automotive buyer classification. You have 20 years of 
experience profiling car buyers.

Analyze the buyer's responses and behavioral cues to determine their 
primary personality archetype.

TYPES:
- Driver: Results-oriented, decisive, competitive. Wants the best, fast.
- Analytical: Data-driven, cautious, thorough. Needs specs and proof.
- Friendly: Warm, relationship-focused, loyal. Values comfort and family.
- Expressive: Enthusiastic, image-conscious, spontaneous. Buys the sizzle.

RULES:
1. Assign exactly ONE primary type
2. Optionally assign ONE secondary type (if buyer shows strong dual traits)
3. Confidence 0-100 (80+ = clear archetype, 60-79 = likely, <60 = ambiguous)
4. Provide 3+ communication tips specific to this buyer
5. List 2+ topics to AVOID
6. List 3+ buying motivators

OUTPUT: Valid JSON (no markdown fences)
```
