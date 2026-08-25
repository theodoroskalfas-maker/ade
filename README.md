# ADE 2026 Parties

A mobile-first calendar of Amsterdam Dance Event 2026 parties (Wed 21 → Mon 26 Oct).
Seeded from a community spreadsheet, with a live "Add a party" form.

- Next.js 15 App Router · Tailwind · React 19
- Storage: **Vercel KV** in prod, plain JSON file in local dev
- Passcode-guarded write endpoint so randos can't spam once it's live

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. User-added parties land in `.data/user-parties.json`
(git-ignored). No env vars needed for dev.

## Update the party seed

The party seed lives in `data/seed.json`, parsed from the source Google Sheet.

**Automatic refresh (recommended)**: a GitHub Actions cron job
(`.github/workflows/refresh-sheet.yml`) re-fetches the sheet every Monday and
Thursday at 07:00 UTC, re-runs the parser, and commits `data/seed.json` back to
`main` **only if it actually changed**. That commit triggers a Vercel redeploy,
so new parties are live automatically within a few minutes.

You can also fire the workflow manually: repo → **Actions** tab →
"Refresh ADE party seed" → **Run workflow**.

Party ids are content-hashed (`s_<sha1_of_day_name_venue>`), so a new party
appearing mid-sheet does **not** shift the ids of neighboring parties — users'
saved favorites (which reference ids) survive every refresh.

**Manual re-pull**, if you ever want to do it yourself:

```bash
# 1. Re-download the sheet as xlsx
curl -sL "https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=xlsx" -o ade.xlsx

# 2. Unzip and run the parser (script lives in scripts/parse-sheet.mjs — see below)
unzip -o ade.xlsx -d ade_unzipped
node scripts/parse-sheet.mjs ade_unzipped data/seed.json
```

(If you didn't keep the parser script, ask me to regenerate it — it's a ~150-line
Node file that reads shared strings, hyperlinks per cell, and the FREE PARTY
highlight color out of the raw XLSX XML.)

## Deploy

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: ADE 2026 party calendar"
git branch -M main
git remote add origin git@github.com:<you>/ade-app.git
git push -u origin main
```

### 2. Import to Vercel

- Go to https://vercel.com/new and import the repo.
- Framework preset: **Next.js** (auto-detected).
- No build tweaks needed. Click Deploy.

### 3. Turn on Vercel KV (shared "add a party" storage)

Without KV, adds fall back to a file on disk — which doesn't persist across
Vercel's serverless invocations, so you'd only see your own additions once
per warm instance. To get shared storage:

- In the Vercel dashboard, open the project → **Storage** → **Create Database** → **KV**.
- Give it a name (e.g. `ade-parties`), pick a region close to Amsterdam, connect it to the project.
- Vercel auto-adds these env vars to the project (no action needed on your side):
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`
  - `KV_REST_API_READ_ONLY_TOKEN`
  - `KV_URL`
- Redeploy. The app now uses KV automatically — you'll see `"backend":"kv"` at `GET /api/parties`.

### 4. Set the passcode

Add one env var so only people with the code can add parties.

- Project → **Settings** → **Environment Variables**:
  - `ADD_PASSCODE` = whatever short passphrase you want to share.
- Redeploy.
- Share the passcode privately with friends who should be able to add.

Leave it empty in production and anyone can add — fine for a private link,
risky for a public one.

## Data model

```ts
type Party = {
  id: string;
  day: 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | 'mon';
  dayLabel: string;      // e.g. "Wed 21"
  name: string;
  venue: string | null;
  artists: string | null;
  ticketUrl: string | null;
  free: boolean;         // came from a yellow-highlighted cell in the sheet
  source: 'sheet' | 'user';
  addedAt?: string;      // ISO — only present for user-added
};
```

Sheet parties are baked into the bundle (`data/seed.json`). User parties live
in KV (or the file fallback). The page merges them at request time and
sorts user-added to the top of each day.

## Endpoints

- `GET /api/parties` → user-added parties + which backend is in use.
- `POST /api/parties` → add a party. Body:
  ```json
  {
    "name": "…", "day": "fri",
    "venue": "…", "artists": "…", "ticketUrl": "https://…",
    "free": false,
    "passcode": "…"
  }
  ```
  Returns 401 if `ADD_PASSCODE` is set on the server and the body's `passcode`
  doesn't match.

## License / attribution

Party data adapted from a community-maintained ADE 2026 spreadsheet.
If you appreciate the source list, follow **ReverseSkydivingClub** on Instagram.
