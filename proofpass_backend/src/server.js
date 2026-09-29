const Fastify = require("fastify");
const cors = require("@fastify/cors");
const config = require("./config");
const { initContract, getContractAddress } = require("./contract");

const issuerRoutes = require("./routes/issuer");
const studentRoutes = require("./routes/student");
const employerRoutes = require("./routes/employer");
const aiRoutes = require("./routes/ai");
const passportRoutes = require("./routes/passport");

async function buildServer() {
  const fastify = Fastify({ logger: true, bodyLimit: 20971520 }); // 20MB limit for image uploads

  await fastify.register(cors, { origin: true });

  fastify.get("/health", async () => {
    let contractAddress = null;
    let chainOk = false;
    try {
      contractAddress = getContractAddress();
      chainOk = true;
    } catch (err) {
      fastify.log.warn(`Contract not reachable yet: ${err.message}`);
    }
    return {
      ok: true,
      chainOk,
      contractAddress,
      groqConfigured: Boolean(config.groqApiKey),
    };
  });

  fastify.register(issuerRoutes, { prefix: "/api/issuer" });
  fastify.register(studentRoutes, { prefix: "/api/students" });
  fastify.register(employerRoutes, { prefix: "/api/employer" });
  fastify.register(aiRoutes, { prefix: "/api/ai" });
  fastify.register(passportRoutes, { prefix: "/" });

  return fastify;
}

async function start() {
  try {
    initContract();
  } catch (err) {
    console.warn(
      `Warning: could not load contract deployment (${err.message}). ` +
        `/health will report chainOk:false until a local chain + deployment exist.`
    );
  }

  const fastify = await buildServer();
  await fastify.listen({ port: config.port, host: "0.0.0.0" });
}

if (require.main === module) {
  start();
}

module.exports = { buildServer };
