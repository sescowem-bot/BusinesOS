# BusinessOS public website — editorial upgrade

## Implemented
- Replaced the root README's chronological phase log with a professional product introduction, architecture, setup, security and release status.
- Added a progressive interactive business-workflow story to the home page with four stages (customer, order, payment, review).
- Product visuals use responsive CSS with restrained perspective, visible focus indicators, native controls and reduced-motion support. No fictitious customer records or unsupported performance claims.
- No new dependencies or SQL migrations. Marketing navigation, content CMS and business dashboard remain unchanged.

## Assessment of React Three Fiber
Source: https://github.com/pmndrs/react-three-fiber (MIT, React renderer for Three.js; React 19 requires matching compatible version).

React Three Fiber is suitable for an *optional, lazy-loaded hero visual* if measured performance allows it, but is not a replacement for UX research, visual design, conversion copy or product usability. Adding WebGL to an already slow banking/accounting-style dashboard would cost performance and accessibility.

Consider an isolated client-only scene only after the following acceptance criteria:
- Existing route latency baseline, Lighthouse/Web Vitals and mobile memory measurements captured.
- Deferred loading after primary hero content, and disabled on reduced-motion or constrained devices.
- Static SSR fallback and WebGL failure fallback.
- Keyboard/accessibility and contrast verified independently.
- No authentication, dashboard, finance or checkout dependency on Canvas/WebGL.
- Build and Vercel preview acceptance with real mobile devices.

The current release intentionally uses **no Three.js dependency**.

## Outstanding seven release gates
Action enforcement, VAT transaction correction, quota enforcement, Paystack end-to-end payment verification, latency profiling, and privacy/retention acceptance remain open. Free-plan cleanup and expiring per-module trial infrastructure have been implemented. Read `MD/CONTROLLED_MODULE_TRIALS_AND_RELEASE_GATES.md`.
