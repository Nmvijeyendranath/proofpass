const { ethers } = require("ethers");

/**
 * Phase 9 — "prove without revealing", implemented as commit/reveal
 * selective disclosure, NOT a zk-SNARK.
 *
 * This is an intentional simplification (see README): a real
 * zero-knowledge range proof (Circom + snarkjs) would let a student prove
 * "my score >= 7" without any party, including this backend, ever seeing
 * the raw score. Here, the raw value briefly passes through this backend
 * so it can evaluate the claim, and only the true/false result plus the
 * issuer identity is returned to the employer. The raw value is never
 * logged, stored, or forwarded past this function.
 *
 * At issuance time, the issuer commits to a value with a random salt:
 *   proofHash = keccak256(value || salt)
 * Only proofHash goes on-chain. The student is given back {value, salt}
 * to keep in their wallet, exactly like a private witness for a proof.
 *
 * At verification time, the student "reveals" {value, salt} to this
 * endpoint (not to the employer). We recompute the hash, check it matches
 * the on-chain proofHash (this is what proves the value hasn't been
 * tampered with since issuance), then evaluate the employer's claim
 * server-side and return only the boolean outcome.
 */

function computeProofHash(value, salt) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["string", "string"], [String(value), String(salt)])
  );
}

function generateSalt() {
  return ethers.hexlify(ethers.randomBytes(16));
}

/**
 * Evaluate a simple claim against a revealed value without ever returning
 * the value itself to the caller of the outer route.
 *
 * Supported claim types:
 *   { type: "gte", threshold: number }   value >= threshold (numeric)
 *   { type: "eq",  expected: string }    value === expected (string/number)
 *   { type: "truthy" }                   value is a non-empty / non-"false" string
 */
function evaluateClaim(claim, value) {
  switch (claim.type) {
    case "gte": {
      const numeric = Number(value);
      if (Number.isNaN(numeric)) return false;
      return numeric >= Number(claim.threshold);
    }
    case "eq": {
      return String(value).trim().toLowerCase() === String(claim.expected).trim().toLowerCase();
    }
    case "truthy": {
      const s = String(value).trim().toLowerCase();
      return s.length > 0 && s !== "false" && s !== "0";
    }
    default:
      throw new Error(`Unsupported claim type: ${claim.type}`);
  }
}

module.exports = { computeProofHash, generateSalt, evaluateClaim };
