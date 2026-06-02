# MedTech Data Platform

A React application for uploading, enriching, visualizing, and exporting medical/health data.
Make sure you're in the Master branch and not Main (I messed up the branching)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.
demo link: https://drive.google.com/file/d/1G413T7v0ekIPGFt9ZCrURrYrSFQMGKr1/view?usp=sharing

TLDR:
1. Started with raw data — a CSV of manufacturer | model | serial number, and a goal: add two columns, device_type and manufactured_date.
2. Found the patterns in the serials — figured out that each manufacturer encodes the date differently (Hill-Rom MM…YYYY, Edan M+YY+month, Cogentix/ADC/Exergen year+week, etc.), and spotted the (21) clue that the data came from UDI barcodes.
3. Built the Enrich step in the React app — a first version that decoded dates and looked up types.
4. Refactored it from per-manufacturer code into a layered, data-driven pipeline (the key architectural change):
  - Tier 1 – universal UDI/barcode parser (works for any manufacturer).
  - Tier 2 – real GUDID device-type lookup via openFDA.
  - Tier 3 – a generic rules engine fed by a config file of serial patterns (+ golden test fixtures).
  - Tier 4 – an LLM, only for leftovers, deduped and batched on a cheap model.
5. Plugged real GUDID in for device type, and added a model-variant normalizer (re-inserting stripped spaces, e.g. SE1200EXPRESS → SE-1200 Express) so far more devices matched — cutting the unknowns way down.
6. Hardened it against wrong answers — required company and model to match, gated company-level guesses behind a dominance threshold, and never fabricated.
7. Trimmed the output to just the two requested columns, and added Visualize (charts) and Export (CSV/JSON) steps.
