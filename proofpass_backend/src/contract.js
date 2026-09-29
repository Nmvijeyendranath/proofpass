const { ethers } = require("ethers");
const config = require("./config");

let provider;
let issuerWallet;
let readContract;
let issuerContract;
let contractAddress;

/**
 * Sets up:
 *  - a read-only contract instance (used for verification, anyone can read)
 *  - an issuer-signed contract instance (used for issuing/revoking, requires
 *    the wallet behind ISSUER_PRIVATE_KEY to be an approved issuer on-chain)
 */
function initContract() {
  const deployment = config.loadDeployment();
  contractAddress = deployment.address;

  provider = new ethers.JsonRpcProvider(config.rpcUrl);
  readContract = new ethers.Contract(contractAddress, deployment.abi, provider);

  if (config.issuerPrivateKey) {
    issuerWallet = new ethers.Wallet(config.issuerPrivateKey, provider);
    issuerContract = readContract.connect(issuerWallet);
  }

  return { provider, readContract, issuerContract, issuerWallet, contractAddress };
}

function getReadContract() {
  if (!readContract) initContract();
  return readContract;
}

function getIssuerContract() {
  if (!issuerContract) initContract();
  if (!issuerContract) {
    throw new Error("ISSUER_PRIVATE_KEY is not configured — issuing routes are disabled.");
  }
  return issuerContract;
}

function getIssuerWallet() {
  if (!issuerWallet) initContract();
  return issuerWallet;
}

function getContractAddress() {
  if (!contractAddress) initContract();
  return contractAddress;
}

module.exports = {
  initContract,
  getReadContract,
  getIssuerContract,
  getIssuerWallet,
  getContractAddress,
};
