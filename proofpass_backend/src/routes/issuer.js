const { z } = require("zod");
const config = require("../config");
const { getIssuerContract } = require("../contract");
const { computeProofHash, generateSalt } = require("../proof");

const issueSchema = z.object({
  studentAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid address"),
  skill: z.string().min(1),
  value: z.string().min(1), // e.g. "advanced", "8.2", "true" — kept off-chain
});

const revokeSchema = z.object({
  studentAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid address"),
  skill: z.string().min(1),
});

/** Simple shared-secret auth for the issuer-only routes (university/assessor UI). */
function requireIssuerApiKey(request, reply, done) {
  const key = request.headers["x-issuer-key"];
  if (!key || key !== config.issuerApiKey) {
    reply.code(401).send({ error: "Missing or invalid x-issuer-key header." });
    return;
  }
  done();
}

async function issuerRoutes(fastify) {
  fastify.addHook("onRequest", requireIssuerApiKey);

  // Phase 2 / Phase 8: university or assessor issues a credential.
  // The raw value (grade, level, etc.) never goes on-chain — only its hash
  // does, along with the issuer address and timestamp.
  fastify.post("/issue", async (request, reply) => {
    const parsed = issueSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { studentAddress, skill, value } = parsed.data;

    const salt = generateSalt();
    const proofHash = computeProofHash(value, salt);

    try {
      const contract = getIssuerContract();
      const tx = await contract.issueSkillCredential(studentAddress, skill, proofHash);
      const receipt = await tx.wait();

      return reply.send({
        ok: true,
        txHash: receipt.hash,
        studentAddress,
        skill,
        proofHash,
        // The student's wallet must store {value, salt} — it is the only
        // way to later prove a claim about this credential. The backend
        // does not store it.
        studentSecret: { value, salt },
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(400).send({ error: err.shortMessage || err.message });
    }
  });

  // Revoke a credential this issuer (or the contract owner) previously issued.
  fastify.post("/revoke", async (request, reply) => {
    const parsed = revokeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { studentAddress, skill } = parsed.data;

    try {
      const contract = getIssuerContract();
      const tx = await contract.revokeCredential(studentAddress, skill);
      const receipt = await tx.wait();
      return reply.send({ ok: true, txHash: receipt.hash, studentAddress, skill });
    } catch (err) {
      request.log.error(err);
      return reply.code(400).send({ error: err.shortMessage || err.message });
    }
  });
}

module.exports = issuerRoutes;
