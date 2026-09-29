# ProofPass frontend

A responsive React + TypeScript frontend demonstration for a privacy-first skill passport with separate student and recruiter views.

## Run locally

Requires Node.js 20+ and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. The default demo uses fictional bundled sample data; it does not create a DID, issue credentials, call AI, contact a zkTLS provider, generate a zero-knowledge proof, connect a wallet, or query a blockchain.

## Frontend routes

- `/` — student overview, guide entry point, sample request, and computed accuracy meter
- `/guide` — how to use the student-facing demo and understand its limits
- `/journey` — 12-step ProofPass concept flow
- `/wallet` — sample credentials and claims
- `/insights` — computed profile-to-evidence match plus illustrative insights
- `/roadmap` — local demo milestone toggles
- `/sharing` — simulated approve/decline student consent flow
- `/employer` — separate recruiter/employer portal with sample claim request lookup
- `/about`, `/privacy`, `/terms`, `/contact` — product and truthful demo notices

The account avatar in the top bar opens a sample profile menu with shortcuts to the guide, wallet, and privacy details.

## Accuracy meter

The meter is calculated at runtime: it normalizes unique profile-skill names and counts exact matches against claims in credentials marked `verified` or `simulated`. It displays the numerator, denominator, and matching rule. It is a profile-to-evidence match rate only—not a real-world AI/model accuracy score or a live verification result.

## Backend integration

Read [`docs/backend-integration.md`](docs/backend-integration.md). The API adapter uses local mock data when `VITE_API_BASE_URL` is empty; setting it switches to the typed HTTP contract. Keep provider credentials on the server, never in `VITE_*` variables.

## Checks

```sh
pnpm typecheck
pnpm build
```
