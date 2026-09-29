# ProofPass

An AI-powered, decentralized career & skill passport. Three separate projects,
run independently:

```
proofpass/
  contracts/   Solidity contract, tests, local deploy script
  backend/     Fastify API — issuing, AI career engine, employer verification
  frontend/    Next.js app — student wallet, issuer console, employer portal
```

## What changed from the original draft

The earlier `ProofPass.sol` draft let **anyone** issue themselves a
credential and had no working revoke path. This build fixes that:

- `approveIssuer` / `removeIssuer` — only the contract owner can approve a
  university/assessor wallet as a trusted issuer.
- `issueSkillCredential` — restricted to approved issuers only.
- `revokeCredential` — restricted to the original issuer (or the owner as a
  fallback). This is what makes the "revoke live, employer check fails
  instantly" demo actually work.
- `verifySkill` — now also checks the issuer is *still* approved, not just
  that the credential exists and isn't individually revoked.

It also separates two things the original plan conflated:

- **zkTLS (Reclaim)** proves data came from a real Web2 session (e.g.
  GitHub). It is a data-import step, not a privacy proof.
- **Phase 9 "prove without revealing"** is implemented here as a
  **commit/reveal selective-disclosure scheme** (see `backend/src/proof.js`),
  not a zk-SNARK. At issuance, the issuer commits to
  `keccak256(value, salt)` on-chain; only that hash is public. To answer an
  employer's yes/no question, the student reveals `{value, salt}` to the
  backend for that one check — the backend confirms it matches the on-chain
  hash, evaluates the claim, and returns **only true/false** to the
  employer, never the raw value. A real zk-SNARK range proof (Circom +
  snarkjs) would remove even that momentary backend visibility — noted as a
  stretch goal, not built here.

## 1. Contracts (`/contracts`)

```bash
cd contracts
npm install
npx hardhat node                                    # terminal 1: local chain
npx hardhat test                                     # 14 tests, all passing
npx hardhat run scripts/deploy.js --network localhost  # terminal 2
```

Deploying writes `deployments/localhost.json` (address + ABI), which the
backend reads automatically. The deploy script also approves the deployer
address as the first issuer ("Demo University") so you can issue credentials
immediately.

Currently deployed locally at: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
(this address changes every time you redeploy to a fresh node).

> Note: this environment's network policy blocks Hardhat's usual solc
> download host. `scripts/solcjs-compile.js` compiles with the npm-installed
> `solc` package instead and writes the artifact in Hardhat's own format —
> run `node scripts/solcjs-compile.js` once before `hardhat test --no-compile`
> if you ever edit the contract. On a machine with normal network access,
> plain `npx hardhat compile` / `npx hardhat test` work directly.

## 2. Backend (`/backend`)

```bash
cd backend
npm install
cp .env.example .env
# .env already points ISSUER_PRIVATE_KEY at the local Hardhat deployer
# account, which the deploy script approved as an issuer. Add a real
# GROQ_API_KEY to get live AI responses instead of the built-in mock.
npm start   # http://localhost:4000
```

Routes:
- `GET  /health` — chain + Groq configuration status
- `POST /api/issuer/issue` — issue a credential (`x-issuer-key` header required)
- `POST /api/issuer/revoke` — revoke a credential (`x-issuer-key` header required)
- `GET  /api/students/:address/credentials?skills=Python,SQL` — on-chain status check
- `POST /api/ai/career-engine` — Phases 4–7: skills, career recommendations, gaps, roadmap
- `POST /api/employer/verify` — Phases 9–11: commit/reveal claim check against the chain

Without a `GROQ_API_KEY`, `/api/ai/career-engine` returns a clearly-labeled
mock response (`_mock: true`) so the rest of the app is testable without a key.

## 3. Frontend (`/frontend`)

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

Three views, matching the three roles in the workflow:
- `/student` — connect a wallet (or paste an address), check credential
  status, run the AI career engine
- `/issuer` — issue and revoke credentials (enter the issuer API key)
- `/employer` — ask a yes/no claim about a candidate's credential

`frontend/.env.local` points `NEXT_PUBLIC_API_BASE_URL` at
`http://127.0.0.1:4000` by default.

## Demo script (the "revoke live" moment)

1. Issuer console: issue `Python = advanced` to a student address. Copy the
   returned `value` + `salt` — that's the student's private secret.
2. Student page: check credentials for `Python` → shows **Verified**.
3. Employer portal: claim "has this skill at all", paste the student's
   `value`/`salt` → **VERIFIED**.
4. Issuer console: revoke `Python` for that student.
5. Employer portal: run the same check again, unchanged inputs → **Not
   valid** ("No valid, non-revoked credential from an approved issuer").

## Verified end-to-end in this build

- 14/14 Hardhat tests passing, including: a student cannot self-issue, an
  unapproved issuer is rejected, only the issuer/owner can revoke, and
  verification returns false the moment an issuer is de-approved even
  without an explicit revoke.
- Backend smoke-tested live against the deployed contract: issue → verify
  (true) → verify with wrong secret (rejected) → revoke → verify again
  (false), plus issuer-route auth rejecting missing/wrong API keys.
- Frontend production build succeeds; all four routes (`/`, `/student`,
  `/issuer`, `/employer`) return 200, and CORS is confirmed open for the
  frontend's origin.
