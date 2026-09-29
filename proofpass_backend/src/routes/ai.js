const { z } = require("zod");
const { runCareerEngine } = require("../ai");

const bodySchema = z.object({
  skillsText: z.string().min(1),
});

async function aiRoutes(fastify) {
  // Phases 4-7 combined: skill profiling, career recommendations, skill
  // gap analysis, and a learning roadmap, from one Groq call.
  fastify.post("/career-engine", async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const result = await runCareerEngine(parsed.data.skillsText);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });
}

module.exports = aiRoutes;
