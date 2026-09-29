// Compiles ProofPassRegistry.sol with the npm-installed solc-js package and
// writes artifacts in the exact shape Hardhat expects, so `hardhat test
// --no-compile` / `hardhat run --no-compile` can use them without Hardhat's
// own compiler downloader (which needs network access to
// binaries.soliditylang.org, which is not reachable in this environment).
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const CONTRACT_NAME = "ProofPassRegistry";
const SRC_PATH = path.join(__dirname, "..", "contracts", `${CONTRACT_NAME}.sol`);
const source = fs.readFileSync(SRC_PATH, "utf8");

const input = {
  language: "Solidity",
  sources: {
    [`${CONTRACT_NAME}.sol`]: { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  let hasError = false;
  for (const err of output.errors) {
    console.log(err.formattedMessage || err.message);
    if (err.severity === "error") hasError = true;
  }
  if (hasError) {
    console.error("Compilation failed.");
    process.exit(1);
  }
}

const contractOutput = output.contracts[`${CONTRACT_NAME}.sol`][CONTRACT_NAME];

const artifact = {
  _format: "hh-sol-artifact-1",
  contractName: CONTRACT_NAME,
  sourceName: `contracts/${CONTRACT_NAME}.sol`,
  abi: contractOutput.abi,
  bytecode: "0x" + contractOutput.evm.bytecode.object,
  deployedBytecode: "0x" + contractOutput.evm.deployedBytecode.object,
  linkReferences: contractOutput.evm.bytecode.linkReferences || {},
  deployedLinkReferences: contractOutput.evm.deployedBytecode.linkReferences || {},
};

const outDir = path.join(__dirname, "..", "artifacts", "contracts", `${CONTRACT_NAME}.sol`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${CONTRACT_NAME}.json`), JSON.stringify(artifact, null, 2));

// Minimal debug file — some Hardhat tooling expects one alongside the artifact.
const dbg = { _format: "hh-sol-dbg-1", buildInfo: null };
fs.writeFileSync(path.join(outDir, `${CONTRACT_NAME}.dbg.json`), JSON.stringify(dbg, null, 2));

// artifacts.d.ts / cache aren't required for tests to run.
console.log(`Wrote artifact for ${CONTRACT_NAME} to ${outDir}`);
