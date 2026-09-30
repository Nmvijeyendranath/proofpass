# ZK Web3 Verification Engine 🛡️

A modular, privacy-first infrastructure skeleton designed to verify authenticated Web2 payloads (such as financial statements, credit history, or enterprise identity) and anchor them as Zero-Knowledge proofs on an EVM-compatible blockchain. 

Originally architected during a 24-hour hackathon (securing a Top 7 finish), this repository has been scrubbed of live APIs and refactored into a clean, deployable engine for fintech, decentralized finance (DeFi), and enterprise privacy applications.

## 🚀 Core Architecture

This engine operates on a three-tier "Intake → Parse → Anchor" pipeline:

1. **Web2 Intake (zkTLS):** Utilises Reclaim Protocol to allow users to log into existing institutional portals (e.g., net banking, payroll). It generates a cryptographic proof of the HTTPS web session payload without exposing login credentials.
2. **AI Payload Extraction:** A backend extraction layer structured for LLM integration (via Groq/Llama). It parses unstructured payload data and verifies boolean financial claims (e.g., `average_balance_verified = true`) via strict JSON schemas. *(Note: Currently set to mock offline execution for rapid prototyping).*
3. **Web3 EVM Settlement:** Instead of storing raw data, the engine converts verified claims into `keccak256` hashes and anchors them to an EVM-compatible smart contract (`ProofPassRegistry.sol`), enabling sub-second, trustless verification by third-party auditors.

## 🛠 Tech Stack

* **Frontend:** React, TypeScript, Tailwind CSS
* **UI/Animations:** GSAP, ScrollTrigger (premium multi-page layout transitions)
* **Backend:** Node.js, Fastify
* **Web3/Blockchain:** Ethers.js, Solidity, Hardhat (EVM-compatible architecture)
* **Zero-Knowledge:** Reclaim Protocol (zkTLS)

## ⚙️ Getting Started (Local Skeleton)

Since this is a decoupled architectural skeleton, it is designed to run locally for development and adaptation. 

### 1. Clone & Install
```bash
git clone [https://github.com/yourusername/zk-verification-engine.git](https://github.com/yourusername/zk-verification-engine.git)
cd zk-verification-engine
npm install
