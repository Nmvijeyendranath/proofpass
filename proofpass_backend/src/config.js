const fs = require("fs");
const path = require("path");
require("dotenv").config();

const DEPLOYMENT_FILE = path.resolve(
  __dirname,
  "..",
  process.env.DEPLOYMENT_FILE || "../contracts/deployments/localhost.json"
);

function loadDeployment() {
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    throw new Error(
      `No deployment file found at ${DEPLOYMENT_FILE}. Run "npx hardhat run scripts/deploy.js --network localhost" in the contracts project first.`
    );
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
}

const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  issuerPrivateKey: process.env.ISSUER_PRIVATE_KEY,
  issuerApiKey: process.env.ISSUER_API_KEY || "dev-issuer-key",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
  loadDeployment,
};

module.exports = config;
