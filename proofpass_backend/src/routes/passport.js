const { getReadContract, getIssuerContract } = require("../contract");
const { runCareerEngine, sanitizeSkillName, normalizeSkills } = require("../ai");
const { computeProofHash, generateSalt } = require("../proof");
const { extractTextFromDocument } = require("../docParser");

// ── In-memory session store ───────────────────────────────────────────────
const proofRequests = new Map();         // proof request state
const roadmapToggles = new Map();        // milestone completion toggles
const inMemoryCredentials = new Map();   // scanned session credentials
let sessionTargetRole = null;            // student's chosen career goal
let sessionRoadmapCache = null;          // cached AI roadmap for this session

// ── Helpers ───────────────────────────────────────────────────────────────
function getSessionSkills() {
  const skills = [];
  for (const [, cred] of inMemoryCredentials.entries()) {
    for (const claim of cred.claims) {
      if (!skills.includes(claim)) skills.push(claim);
    }
  }
  return skills;
}

function buildWorkflow({ hasCredentials, skills, credentials, recommendations, gaps, roadmap, proofRequest, contractAddr }) {
  const proofDecided  = proofRequest?.status === "approved" || proofRequest?.status === "declined";
  const proofApproved = proofRequest?.status === "approved";
  const hasRoadmap    = roadmap.length > 0 && !(roadmap.length === 1 && roadmap[0].id === "no-skills");

  return [
    {
      id: 1, eyebrow: "Identity",
      title: "Create local DID",
      description: "Automatically created in the browser. Use Copy DID if needed.",
      state: "complete",
      detail: "Holder 0x1111…1111 · MST Testnet.",
      actionLabel: "View Wallet", actionPath: "/wallet"
    },
    {
      id: 2, eyebrow: "Issuance",
      title: "Upload certificate",
      description: "Go to Wallet & credentials, upload the image, and click Read & save certificate.",
      state: hasCredentials ? "complete" : "current",
      detail: hasCredentials
        ? `${credentials.length} credential(s) issued to your wallet.`
        : "Go to Wallet & credentials → drag & drop a document.",
      actionLabel: "Upload Document", actionPath: "/wallet"
    },
    {
      id: 3, eyebrow: "AI layer",
      title: "Review extracted details",
      description: "Confirm the issuer, date, source image, OCR text, and detected skill such as Full Stack Development.",
      state: hasCredentials ? "complete" : "upcoming",
      detail: hasCredentials
        ? `${skills.length} skill(s): ${skills.join(", ")}`
        : "Populates after your first scan.",
      actionLabel: "Review Credentials", actionPath: "/wallet"
    },
    {
      id: 4, eyebrow: "AI layer",
      title: "Open Skill insights",
      description: "Review the detected skill and transparent rule-based career directions.",
      state: recommendations.length > 0 ? "complete" : (hasCredentials ? "current" : "upcoming"),
      detail: recommendations.length > 0
        ? `Top: ${recommendations[0]?.role} (${recommendations[0]?.fit})`
        : "See Skill insights after scanning.",
      actionLabel: "View Insights", actionPath: "/insights"
    },
    {
      id: 5, eyebrow: "Learning",
      title: "Follow the improvement roadmap",
      description: "Open Learning roadmap and manually complete: Build a responsive frontend project, Connect an API, etc.",
      state: hasRoadmap ? "complete" : (hasCredentials ? "current" : "upcoming"),
      detail: hasRoadmap ? "See Learning roadmap page." : "Available after scan.",
      actionLabel: "Open Roadmap", actionPath: "/roadmap"
    },
    {
      id: 6, eyebrow: "Consent",
      title: "Create a recruiter request",
      description: "Go to Recruiter portal, enter the copied local DID, and request a claim such as 'full stack'.",
      state: proofRequest ? "complete" : "upcoming",
      detail: proofRequest
        ? `Request from ${proofRequest.from} for "${proofRequest.requestedClaim}"`
        : "Use the Recruiter portal to create a request.",
      actionLabel: "Go to Recruiter Portal", actionPath: "/employer"
    },
    {
      id: 7, eyebrow: "Consent",
      title: "Approve the claim",
      description: "Open Proof sharing, review the requested claim, and click Approve request.",
      state: proofDecided ? "complete" : (proofRequest ? "current" : "upcoming"),
      detail: proofDecided
        ? `Decision recorded: ${proofRequest.status}`
        : proofRequest ? "Go to Proof sharing and approve or decline." : "Waiting for employer request.",
      actionLabel: "Review Request", actionPath: "/sharing"
    },
    {
      id: 8, eyebrow: "Trust",
      title: "Check the result",
      description: "Return to Recruiter portal → VC Inspector, enter the DID and 'full stack'.",
      state: proofApproved ? "complete" : "upcoming",
      detail: `Registry: ${contractAddr} · MST Testnet.`,
      actionLabel: "Inspect VC", actionPath: "/employer"
    },
    {
      id: 9, eyebrow: "Outcome",
      title: "View claim-only result",
      description: "The result shows only Full Stack Development, issuer, and date. The full certificate remains private.",
      state: proofApproved ? "complete" : "upcoming",
      detail: proofApproved
        ? "Complete. Recruiter received skill confirmation only."
        : "Final step — triggered after you approve.",
      actionLabel: "View Outcome", actionPath: "/employer"
    },
  ];
}

// ── Convert AI roadmap items to frontend RoadmapItem shape ────────────────
function buildRoadmapItems(aiRoadmap) {
  const toggles = {};
  for (const [k, v] of roadmapToggles.entries()) toggles[k] = v;

  return aiRoadmap.map((rm, i) => {
    const id = `milestone-${i}`;
    const status = toggles[id] || "next";
    return {
      id,
      title:  rm.milestone,
      skill:  rm.skill || "",
      detail: rm.description
        ? rm.description
        : rm.projectSuggestion
          ? `${rm.projectSuggestion} · ${rm.durationWeeks}w`
          : `${rm.durationWeeks} weeks`,
      why:            rm.why || "",
      durationWeeks:  rm.durationWeeks || 2,
      tasks:          Array.isArray(rm.tasks) ? rm.tasks : [],
      resources:      Array.isArray(rm.resources) ? rm.resources : [],
      prerequisites:  Array.isArray(rm.prerequisites) ? rm.prerequisites : [],
      status,
    };
  });
}

async function passportRoutes(fastify) {

  // ── GET /passport ────────────────────────────────────────────────────────
  fastify.get("/passport", async (request, reply) => {
    const skills = getSessionSkills();
    const credentials = [];
    for (const [, cred] of inMemoryCredentials.entries()) {
      credentials.push(cred);
    }

    const hasCredentials = credentials.length > 0;
    const proofRequest = proofRequests.get("request-001") || null;
    const holderAddress = "0x1111111111111111111111111111111111111111";
    const network = "MST Testnet (live)";

    let recommendations = [];
    let gaps = [];
    let roadmap = [];
    let targetRole = sessionTargetRole || null;

    if (hasCredentials) {
      try {
        // Use cached roadmap if skills and target haven't changed (avoid re-calling AI on every poll)
        let aiResult = sessionRoadmapCache;
        if (!aiResult) {
          aiResult = await runCareerEngine(skills.join(", "), null, targetRole);
          sessionRoadmapCache = aiResult;
        }

        if (aiResult) {
          recommendations = (aiResult.careerRecommendations || []).map((r) => ({
            role:   r.role || "Role",
            fit:    r.fitScore ? `${r.fitScore}% Match` : (r.fit || "Good fit"),
            reason: r.why || r.reason || "",
            matchingSkills: r.matchingSkills || [],
          }));

          gaps = (aiResult.skillGaps || []).map((g) => ({
            skill:    g.targetRole ? `For ${g.targetRole}` : (g.skill || ""),
            priority: "High",
            action:   g.missingSkills ? `Missing: ${g.missingSkills.join(", ")}` : (g.action || ""),
            explanation: g.explanation || "",
            missingSkills: g.missingSkills || [],
          }));

          if (aiResult.roadmap && aiResult.roadmap.length > 0) {
            roadmap = buildRoadmapItems(aiResult.roadmap);
          }
        }
      } catch (err) {
        request.log.error(`AI Engine Error: ${err.message}`);
      }
    }

    if (roadmap.length === 0) {
      roadmap = [{
        id:            "no-skills",
        title:         "Upload a document to get started",
        skill:         "",
        detail:        "Scan a certificate or resume to generate your personalised learning roadmap.",
        why:           "",
        durationWeeks: 0,
        tasks:         [],
        resources:     [],
        prerequisites: [],
        status:        "next",
      }];
    }

    let contractAddr = "0xB791564359998B8cEd11C91deeE0BcC36de6Ce52";
    try {
      const contract = getReadContract();
      contractAddr = contract.target || contract.address || contractAddr;
    } catch {}

    const workflow = buildWorkflow({ hasCredentials, skills, credentials, recommendations, gaps, roadmap, proofRequest, contractAddr });

    return reply.send({
      holder: { name: "ProofPass Holder", did: `did:proofpass:mst:${holderAddress}`, network },
      credentials,
      workflow,
      skills,
      recommendations,
      gaps,
      roadmap,
      proofRequest,
      targetRole,
      isAiGenerated: hasCredentials,
    });
  });

  // ── POST /set-career-goal ────────────────────────────────────────────────
  fastify.post("/set-career-goal", async (request, reply) => {
    const { role } = request.body || {};
    if (!role || typeof role !== "string" || role.trim().length < 2) {
      return reply.code(400).send({ error: "role must be a non-empty string" });
    }
    sessionTargetRole = role.trim();
    // Invalidate cache so next GET /passport regenerates with the new target role
    sessionRoadmapCache = null;
    return reply.send({ success: true, targetRole: sessionTargetRole });
  });

  // ── POST /regenerate-roadmap ─────────────────────────────────────────────
  fastify.post("/regenerate-roadmap", async (request, reply) => {
    const { targetRole } = request.body || {};
    if (targetRole && typeof targetRole === "string" && targetRole.trim().length > 1) {
      sessionTargetRole = targetRole.trim();
    }
    // Clear cache to force fresh AI generation
    sessionRoadmapCache = null;
    // Clear milestone toggles so new roadmap starts fresh
    roadmapToggles.clear();

    const skills = getSessionSkills();
    if (skills.length === 0) {
      return reply.code(400).send({ error: "No skills found. Upload a document first." });
    }

    try {
      const aiResult = await runCareerEngine(skills.join(", "), null, sessionTargetRole);
      sessionRoadmapCache = aiResult;

      const roadmap = buildRoadmapItems(aiResult.roadmap || []);
      const recommendations = (aiResult.careerRecommendations || []).map((r) => ({
        role: r.role, fit: `${r.fitScore}% Match`, reason: r.why, matchingSkills: r.matchingSkills || [],
      }));
      const gaps = (aiResult.skillGaps || []).map((g) => ({
        skill: `For ${g.targetRole}`, priority: "High",
        action: `Missing: ${g.missingSkills?.join(", ")}`,
        explanation: g.explanation || "",
        missingSkills: g.missingSkills || [],
      }));

      return reply.send({ success: true, targetRole: sessionTargetRole, roadmap, recommendations, gaps, aiMock: !!aiResult._mock });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: `Roadmap generation failed: ${err.message}` });
    }
  });

  // ── POST /proof-requests/:id/decision ────────────────────────────────────
  fastify.post("/proof-requests/:id/decision", async (request, reply) => {
    const { id } = request.params;
    const { decision } = request.body || {};
    if (!["approved", "declined"].includes(decision)) {
      return reply.code(400).send({ error: "decision must be 'approved' or 'declined'" });
    }
    const existing = proofRequests.get(id) || {
      id, from: "Employer", role: "Candidate", requestedClaim: "skill", expires: "31 Dec 2026", status: "pending",
    };

    if (decision === "approved") {
      const candidateSkills = getSessionSkills();
      const reqSkill = (existing.requestedClaim || "").trim().toLowerCase();
      const candidateHasSkill = candidateSkills.some(
        (s) => s.toLowerCase() === reqSkill || s.toLowerCase().includes(reqSkill) || reqSkill.includes(s.toLowerCase())
      );
      if (!candidateHasSkill) {
        return reply.code(400).send({
          error: `Cannot approve: You do not possess a verified credential for "${existing.requestedClaim}" in your wallet.`
        });
      }
    }

    const updated = { ...existing, status: decision };
    proofRequests.set(id, updated);
    return reply.send(updated);
  });

  // ── POST /roadmap/:id/toggle ──────────────────────────────────────────────
  fastify.post("/roadmap/:id/toggle", async (request, reply) => {
    const { id } = request.params;
    const current = roadmapToggles.get(id) || "next";
    roadmapToggles.set(id, current === "done" ? "next" : "done");
    return reply.send({ id, status: roadmapToggles.get(id) });
  });

  // ── POST /request-proof ──────────────────────────────────────────────────
  fastify.post("/request-proof", async (request, reply) => {
    const { address, skill } = request.body || {};
    if (!address || !skill) return reply.code(400).send({ error: "Address and skill required" });
    proofRequests.set("request-001", {
      id:             "request-001",
      from:           "Recruiter Portal",
      role:           "Candidate",
      requestedClaim: skill,
      expires:        "31 Dec 2026",
      status:         "pending",
    });
    return reply.send({ success: true });
  });

  // ── GET /check-proof ─────────────────────────────────────────────────────
  fastify.get("/check-proof", async (request, reply) => {
    const proofReq = proofRequests.get("request-001");
    if (!proofReq) return reply.send({ status: "pending" });
    if (proofReq.status === "approved") {
      const candidateSkills = getSessionSkills();
      const reqSkill = (proofReq.requestedClaim || "").trim().toLowerCase();
      const candidateHasSkill = candidateSkills.some(
        (s) => s.toLowerCase() === reqSkill || s.toLowerCase().includes(reqSkill) || reqSkill.includes(s.toLowerCase())
      );
      if (!candidateHasSkill) {
        return reply.send({
          status: "declined",
          report: `Verification failed: Candidate does not hold a verified credential for "${proofReq.requestedClaim}".`,
        });
      }

      return reply.send({
        status: "approved",
        report: `The candidate's verified credential for "${proofReq.requestedClaim}" confirms strong competency. ` +
          `Recommended for roles requiring ${proofReq.requestedClaim}. ` +
          `Skill level: Intermediate–Advanced based on blockchain-attested credential.`,
      });
    }
    return reply.send({ status: proofReq.status });
  });

  // ── GET /verify-vc ───────────────────────────────────────────────────────
  fastify.get("/verify-vc", async (request, reply) => {
    const { address, skill } = request.query || {};
    if (!skill) return reply.send({ valid: false, reason: "Skill parameter missing" });

    const querySkill   = String(skill).trim().toLowerCase();
    const queryAddress = String(address || "").trim().toLowerCase();

    // 1. Check in-memory credentials first
    for (const [, cred] of inMemoryCredentials.entries()) {
      const hasSkill = (cred.claims || []).some(
        (c) =>
          String(c).trim().toLowerCase() === querySkill ||
          String(c).toLowerCase().includes(querySkill) ||
          querySkill.includes(String(c).toLowerCase())
      );
      if (hasSkill) return reply.send({ valid: true, credential: cred, source: "in-memory" });
    }

    // 2. Check contract on blockchain
    try {
      const contract = getReadContract();
      const targetAddress = queryAddress && queryAddress.length >= 10
        ? address
        : "0x1111111111111111111111111111111111111111";
      const [isValid, issuer, proofHash] = await contract.verifySkill(targetAddress, skill);
      if (isValid) return reply.send({ valid: true, issuer, proofHash, source: "blockchain" });
    } catch (err) {
      request.log.warn(`Blockchain verifySkill check failed: ${err.message}`);
    }

    // Skill is not present in candidate's credentials
    return reply.send({ valid: false, reason: `Candidate does not hold a verified credential for "${skill}".` });
  });

  // ── POST /scan-document ──────────────────────────────────────────────────
  fastify.post("/scan-document", async (request, reply) => {
    const { text, image, fileData, fileName, fileType } = request.body || {};
    if ((!text || text.trim().length === 0) && !image && !fileData) {
      return reply.code(400).send({ error: "No text, document, or image provided." });
    }

    try {
      // Extract clean text from PDF, Word DOCX, text files, or raw text input
      let cleanText = await extractTextFromDocument({ text, fileData, fileName, fileType });
      if (cleanText && cleanText.startsWith("[Image")) {
        cleanText = "";
      }

      // Run AI to extract skills (pass targetRole if already set)
      const aiResult = await runCareerEngine(cleanText || null, image || null, sessionTargetRole);
      const rawSkills = aiResult.skills || [];

      const extractedSkills = rawSkills
        .map((s) => (typeof s === "string" ? s.trim() : typeof s === "object" && s.name ? String(s.name).trim() : null))
        .map(sanitizeSkillName)
        .filter(Boolean)
        .slice(0, 25); // allow up to 25 skills per document

      if (extractedSkills.length === 0) {
        return reply.code(400).send({ error: "Could not extract valid skills from the document." });
      }

      request.log.info(`Extracted skills: ${extractedSkills.join(", ")}`);

      // Invalidate roadmap cache — new skills require new roadmap
      sessionRoadmapCache = null;

      const holderAddress = "0x1111111111111111111111111111111111111111";
      const issued = [];
      let chainError = null;

      try {
        const contract = getIssuerContract();
        const mintResults = await Promise.allSettled(
          extractedSkills.map(async (skill) => {
            const salt = generateSalt();
            const proofHash = computeProofHash("verified", salt);
            const tx = await contract.issueSkillCredential(holderAddress, skill, proofHash);
            await Promise.race([
              tx.wait(),
              new Promise((_, reject) => setTimeout(() => reject(new Error("tx timeout")), 10000)),
            ]);
            request.log.info(`Minted on-chain: ${skill}`);
            return skill;
          })
        );
        for (let i = 0; i < mintResults.length; i++) {
          const r = mintResults[i];
          if (r.status === "fulfilled") {
            issued.push(r.value);
          } else {
            request.log.warn(`Could not mint "${extractedSkills[i]}" on-chain: ${r.reason?.message}`);
            issued.push(extractedSkills[i]);
          }
        }
      } catch (contractErr) {
        chainError = contractErr.message;
        request.log.warn(`Blockchain unavailable: ${chainError}. Using in-memory.`);
        issued.push(...extractedSkills);
      }

      if (issued.length > 0) {
        const credId = `vc-mem-${Date.now()}`;
        // Clear old credentials so scanning a new doc replaces instead of appending
        inMemoryCredentials.clear();
        
        issued.forEach((skill, i) => {
          inMemoryCredentials.set(`${credId}-${i}`, {
            id:        `${credId}-${i}`,
            type:      "SkillCredential",
            issuer:    "ProofPass AI Scanner",
            issuerDid: `did:proofpass:scanner:${holderAddress.substring(0, 6)}`,
            issued:    new Date().toLocaleDateString("en-IN"),
            expires:   "Never",
            status:    chainError ? "simulated" : "verified",
            claims:    [skill],
            source:    chainError ? "in-memory" : "blockchain",
          });
        });
      }

      return reply.send({
        success: true,
        skills: issued,
        chainError: chainError ? "Minted in-memory (blockchain unavailable)" : null,
        aiMock: !!aiResult._mock,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: `Scan failed: ${err.message}` });
    }
  });

  // ── POST /reset ──────────────────────────────────────────────────────────
  fastify.post("/reset", async (request, reply) => {
    inMemoryCredentials.clear();
    roadmapToggles.clear();
    proofRequests.clear();
    sessionRoadmapCache = null;
    sessionTargetRole = null;
    return reply.send({ success: true });
  });
}

module.exports = passportRoutes;