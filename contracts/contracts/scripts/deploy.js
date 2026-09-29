const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ProofPassRegistry with account:", deployer.address);
  console.log("Network:", network.name);

  const Registry = await ethers.getContractFactory("ProofPassRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("ProofPassRegistry deployed to:", address);

  // Approve the deployer itself as the first issuer, so local demos and the
  // backend can issue credentials immediately without a second transaction.
  const tx = await registry.approveIssuer(deployer.address, "Demo University");
  await tx.wait();
  console.log("Approved deployer as an issuer (Demo University)");

  // Export ABI + address so the backend and frontend can pick it up directly.
  const artifact = await hre_artifact();
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });

  const deploymentInfo = {
    network: network.name,
    address,
    deployer: deployer.address,
    abi: artifact.abi,
  };

  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("Wrote deployment info to", outFile);
}

async function hre_artifact() {
  const hre = require("hardhat");
  return hre.artifacts.readArtifact("ProofPassRegistry");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
