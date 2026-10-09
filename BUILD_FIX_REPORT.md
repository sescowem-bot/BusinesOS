# BusinessOS Phase 15 build repair

Source: user-provided `businessos-phase15-security-hardening(1).zip`, preserved in full.

Fixes:
- `components/ui.tsx` Card now accepts optional `style` and applies it to the DOM.
- `tsconfig.json` target raised to ES2020, enabling BigInt used in the tax engine and its tests.

All other existing project files were retained. The `.env.example` is included but no environment secrets are bundled.

After extracting, run `npm install`, `npm run typecheck`, and `npm run build`; commit and push only after both checks succeed.
