# ProofPass frontend ↔ backend seam

This repository is **frontend-only** and provides separate student and recruiter views. The student starts at `/`; the recruiter demo is at `/employer`. Both views use fictional bundled state in mock mode and do not perform live verification. With `VITE_API_BASE_URL` empty (the default), `src/api.ts` uses the bundled sample-data adapter. No browser-side API key, provider secret, wallet private key, or RPC credential is needed.

## Configure a future API

Copy `.env.example` to `.env.local` and set a public API base, for example:

```env
VITE_API_BASE_URL=/api
```

Vite exposes `VITE_*` values to browser code. Use this variable only for a public base URL; **never** put `GROQ_API_KEY`, `RECLAIM_APP_SECRET`, `PRIVATE_KEY`, deployer keys, or other secrets in it. Keep those values in the backend's protected environment. With a configured URL, API errors are shown instead of being silently replaced with sample data.

## Current typed operations

The TypeScript models in `src/types.ts` are the frontend contract. The HTTP adapter calls these routes relative to the configured base:

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/passport` | none | `PassportData` |
| `POST` | `/proof-requests/:id/decision` | `{ "decision": "approved" | "declined" }` | updated `ProofRequest` |
| `POST` | `/roadmap/:id/toggle` | `{}` | `RoadmapItem[]` |

All success responses must be JSON with the shape in `src/types.ts`. Non-2xx and non-JSON responses become visible UI errors. Real approval, proof generation, issuer trust, and revocation checks must be enforced by the backend and must not be inferred from this UI. The accuracy meter is a transparent exact-match calculation over profile skills and eligible credential claims; it is not a model-accuracy evaluation.

## Security and privacy boundaries

- Keep API keys and contract administration credentials server-side.
- Authenticate and authorize the holder before returning private credential material.
- Validate request payloads and enforce consent server-side; do not treat a browser button as authorization.
- Share only the minimum claim explicitly approved by the student; never return a full credential to a recipient.
- Do not place personal attributes, secrets, or raw credential payloads on-chain.
- Return explicit simulated/live status only after the backend's actual provenance and verification path is defined.
- Review CORS, CSRF, logging, retention, revocation, and error redaction before using real data.

No live Groq, Reclaim/zkTLS, wallet, Solidity contract, RPC, QR, or blockchain integration is included in this frontend handoff.
