# BusinessOS public experience, favicon and pricing phase — 25 October 2026

## Production branding facts (read-only)
On the existing platform project the public brand record names the platform `SESCO BUSINESS APP` but neither `logo_url` nor `favicon_url` currently contains an uploaded asset. The blue "B" came from a static fallback, not from the saved platform name.

## Implemented
- Brand Studio now explains which file controls the header, browser tab and installable-app icon and previews the exact generated icon.
- The new icon endpoint supports 64 (browser tab), 180 (Apple), 192 (PWA) and 512 px (standard and maskable) PNG icons. It reads the current brand name, colours and optionally the uploaded favicon/logo.
- Resolution order is dedicated public favicon PNG/WebP/JPEG, then public logo PNG/WebP/JPEG, then the saved platform name's initial. Direct ICO favicons use their native browser file URL.
- Remote assets are fetched only from the public platform-brand-assets storage bucket at the configured Supabase origin, with strict image type and byte limits. A failed image fetch falls back to the brand initial instead of a broken icon.
- Manifest URLs are tied to the brand asset/version fingerprint; uploads trigger the pre-existing public-brand cache invalidation. No SQL is necessary.
- The pricing page includes a searchable-by-workflow decision aid with monthly vs annual price views and an optional differences-only comparison table. These views rely on the current published plan grants, never invent features/prices, and do not affect checkout.
- The public static SVG fallback no longer contains the old letter B.

## Acceptance checks
1. Before upload, open browser tab, icon image URL and manifest: brand name initial should be S, not B.
2. System Owner > Brand Studio: upload a platform logo PNG; verify the navigation logo, generated browser icon and PWA icons change after refreshing.
3. Upload a separate square PNG or WebP favicon; it should override the logo across browser and install icons. ICO may still be used for browser favicon but not for generated PNG PWA imagery.
4. Confirm Windows/Android browsers may cache existing favicons and installed apps may need refresh/reinstall. Check a private tab, icon URL with new version and actual HTML icon link.
5. Pricing: validate all five workflow categories against the published assignments; annual unavailable should not become guessed price. Click a result to the actual plan card; checkout remains unchanged.
6. Run TypeScript, unit regression suite and Next.js production build, then verify on the intended Vercel project.

## Constraints
No new branches, no new graphics packages, no extra database migrations, no checkout/subscription write modifications. This is one consolidated frontend phase.
