# BusinessOS

Production-oriented small-business operating platform, built web-first and designed for a later React Native/Expo mobile app.

## Stack
- Next.js 16 + TypeScript
- Supabase Postgres/Auth/RLS
- Vercel-ready
- Mobile-first responsive UI

## Run
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill Supabase values for production data.
3. `npm run dev`
4. Open `http://localhost:3000`.

Without Supabase environment variables the UI runs in demo mode using safe local sample data. Do not treat demo data as production data.

## Database
Apply `supabase/migrations/001_core.sql` to a fresh Supabase project. The migration includes multi-tenant tables, financial constraints, calculation functions, indexes and RLS policies.

## Build roadmap
The UI includes the complete Phase 1–10 information architecture. Payment-provider, WhatsApp API, automated notifications, subscription billing and partner API adapters should be connected through server-side modules before production launch.
