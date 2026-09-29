const { z } = require("zod");
const { getReadContract } = require("../contract");

const querySchema = z.object({
  skills: z.string().min(1), // comma-separated list
});

async function studentRoutes(fastify) {
  // Phase 3 / Phase 11 read: check the current on-chain status of a list of
  // skills for a student's wallet, so the wallet UI can show valid /
  // revoked / not-issued without exposing anything private.
  fastify.get("/:address/credentials", async (request, reply) => {
    const { address } = request.params;
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Pass ?skills=Python,SQL,"Data Structures"' });
    }
    const skills = parsed.data.skills.split(",").map((s) => s.trim()).filter(Boolean);

    try {
      const contract = getReadContract();
      const results = await Promise.all(
        skills.map(async (skill) => {
          const [isValid, issuer] = await contract.verifySkill(address, skill);
          return { skill, isValid, issuer };
        })
      );
      return reply.send({ address, credentials: results });
    } catch (err) {
      request.log.error(err);
      return reply.code(400).send({ error: err.shortMessage || err.message });
    }
  });
}

module.exports = studentRoutes;
