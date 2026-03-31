# 💰 Monetization Strategy

SalesGenie employs a B2B SaaS pricing model focused on dealership rooftops, scaling based on the size of the sales team and volume of usage.

## Tier 1: Pro (Single User / Boutique Repo)
Target: Independent auto brokers, small used car lots.
- **Price**: $49 / month per user.
- **Includes**:
  - Unlimited VIN Decodes.
  - 100 Personality Pitch Generations / month.
  - Marketplace Listing Generator.
- **Excludes**:
  - Sales Matchmaker (not needed for solo operators).
  - Dealer Context (promos, inventory days).

## Tier 2: Dealership Team (The Sweet Spot)
Target: Mid-size franchised and independent dealerships.
- **Price**: $399 / month per rooftop.
- **Includes**:
  - Up to 15 User Accounts.
  - Unlimited VIN Decodes.
  - Unlimited Pitch Generations.
  - Full Sales Matchmaker Engine.
  - Dealer Context Injection (Add current promos/rates to pitches).
  - Dealership Analytics Dashboard (Which reps are skipping the app, which archetypes walk on the lot most often).

## Tier 3: Dealer Group / Enterprise
Target: Mega-dealers (Lithia, AutoNation) or dealer groups with 5+ rooftops.
- **Price**: Custom ($1,500+ / month) + setup fee.
- **Includes**:
  - Everything in Tier 2.
  - API Access: Integrate the D.O.E. engine directly into their existing CRM/DMS.
  - Custom Personality Prompting (Adjust the AI's tone to match their specific brand guidelines).
  - Single Sign-On (SSO).

---

## Unit Economics & Costs
- **NHTSA API (VIN Decode)**: Free (Public API).
- **Gemini 2.5 Flash API**: ~$0.0001 per generation (~$0.10 for 1,000 pitches).
- **Compute (Google Cloud Run)**: Scales to zero. ~$15/month baseline.
- **Margin**: > 95% gross margin on software. The primary costs are customer acquisition (CAC) and onboarding.
