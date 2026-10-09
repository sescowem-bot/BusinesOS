# TypeScript build fix — 2026-10-09

Based on Vercel commit c41aa01 build logs.

1. `components/ui.tsx`: the reusable `Card` component now accepts optional `style?: CSSProperties`, preserving the marketplace layout.
2. `tsconfig.json`: target changed from ES2017 to ES2020 to support `BigInt` literals in the tax engine and its tests.
3. JSX mode normalized to `react-jsx` to reflect Next.js 16's required setting.

No tax calculations, SQL migrations, landing-page content, authentication behavior or business logic were modified.

## Deployment
Replace the GitHub repository files with this project and commit to `main`. Ensure deleted legacy auth routes are absent. Then redeploy on Vercel.

## Verification
The Vercel log establishes that route checking and Turbopack compilation completed, but TypeScript failed on the two issues above. Full local Next.js build was unavailable without dependencies; the deployed build remains the final validation.
