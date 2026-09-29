require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const AMOY_RPC_URL = process.env.RPC_URL_AMOY || "https://rpc-amoy.polygon.technology";
const BRIDGE_KEY_MNEMONIC = process.env.BRIDGE_KEY_MNEMONIC;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    amoy: {
      url: AMOY_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 80002,
    },
    mst: {
      url: "https://testnetrpc.mstblockchain.com",
      accounts: BRIDGE_KEY_MNEMONIC ? { mnemonic: BRIDGE_KEY_MNEMONIC } : [],
      chainId: 91562037,
    },
  },
};
