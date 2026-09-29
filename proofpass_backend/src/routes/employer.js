const { z } = require("zod");
const { getReadContract } = require("../contract");
const { computeProofHash, evaluateClaim } = require("../proof");

const claimSchema = z.union([
  z.object({ type: z.literal("gte"), threshold: z.number() }),
  z.object({ type: z.literal("eq"), expected: z.string() }),
  z.object({ type: z.literal("truthy") }),
]);

const verifySchema = z.object({
  studentAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  skill: z.string().min(1),
  claim: claimSchema,
  // Revealed by the student's wallet for this one check only — never
  // forwarded to the employer past this function's return value.
  reveal: z.object({
    value: z.string().min(1),
    salt: z.string().min(1),
  }),
});

async function employerRoutes(fastify) {
  // Phase 10 + 11: employer asks a yes/no question about a student's
  // credential. The chain confirms the credential is real, unrevoked, and
  // from a still-approved issuer; the revealed value is only used locally
  // to answer the employer's specific claim and is never returned.
  fastify.post("/verify", async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { studentAddress, skill, claim, reveal } = parsed.data;

    try {
      const contract = getReadContract();
      const [isValid, issuer, storedProofHash] = await contract.verifySkill(studentAddress, skill);

      if (!isValid) {
        return reply.send({
          verified: false,
          reason: "No valid, non-revoked credential from an approved issuer for this skill.",
        });
      }

      const recomputedHash = computeProofHash(reveal.value, reveal.salt);
      if (recomputedHash !== storedProofHash) {
        return reply.send({
          verified: false,
          reason: "Revealed value does not match the committed on-chain proof hash.",
        });
      }

      const claimHolds = evaluateClaim(claim, reveal.value);

      // Note: reveal.value is intentionally NOT included in the response.
      return reply.send({
        verified: true,
        claimHolds,
        skill,
        issuer,
        studentAddress,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(400).send({ error: err.shortMessage || err.message });
    }
  });
}

module.exports = employerRoutes;
