const Groq = require("groq-sdk");
const config = require("./config");

// ── Model names (kept up-to-date with Groq's availability) ────────────────
const TEXT_MODEL = "llama-3.1-8b-instant"; // fast inference, current
const VISION_MODEL = "llama-3.2-11b-vision-preview"; // image-capable

// ── System prompt for full career engine ─────────────────────────────────
const CAREER_SYSTEM_PROMPT = `You are the AI career engine inside ProofPass, a decentralized student skill passport.
You receive a student's resume text or extracted skills and optionally their target career role.
Return ONLY valid JSON matching this exact shape (no prose, no markdown fences):

{
  "skills": [{ "name": string, "level": "beginner"|"intermediate"|"advanced" }],
  "careerRecommendations": [
    { "role": string, "fitScore": number, "why": string, "matchingSkills": string[] }
  ],
  "skillGaps": [
    {
      "targetRole": string,
      "missingSkills": string[],
      "explanation": string
    }
  ],
  "roadmap": [
    {
      "milestone": string,
      "skill": string,
      "description": string,
      "why": string,
      "durationWeeks": number,
      "tasks": string[],
      "resources": [{ "title": string, "url": string }],
      "prerequisites": string[]
    }
  ]
}

Rules:
- skills: Extract ALL technical skills, programming languages, frameworks, tools, databases, cloud platforms, and domain knowledge mentioned in the input. Be thorough — a good resume should yield 10-20+ skills. Include both explicitly stated skills AND skills evident from described projects/experience.
- careerRecommendations: exactly 3 roles, fitScore 0-100, matchingSkills lists skills already possessed.
- skillGaps: gaps for the TOP recommended role only (or the user's chosen targetRole if provided).
- roadmap: 4-6 milestones ordered from foundational → advanced. Each milestone closes a specific skill gap.
- tasks: 2-3 concrete, actionable tasks per milestone (e.g., "Build a REST API with FastAPI and PostgreSQL").
- resources: 1-2 real, well-known learning resources per milestone with real URLs (e.g., official docs, freeCodeCamp, Coursera).
- prerequisites: list 0-2 milestone titles that must be completed first (or empty array).
- skill names MUST be short plain strings (e.g., "Python", "React") — never objects or sentences.
- DO NOT mark any milestone as complete — all start unchecked.
- Adapt content to the actual skills provided. DO NOT give generic milestones.
- If targetRole is provided, generate the roadmap specifically for that role.
- Output must be ONLY valid JSON with no extra text.`;

// ── System prompt for vision (image → skills only) ────────────────────────
const VISION_SYSTEM_PROMPT = `You are an expert at reading certificates, resumes, and academic documents.
Extract all skills, technologies, programming languages, frameworks, tools, and competencies mentioned.
Return ONLY a JSON array of short skill name strings.
Example: ["Python", "Machine Learning", "TensorFlow", "Data Analysis", "SQL"]
Return ONLY the JSON array with no other text.`;

// ── Known technical skills dictionary ─────────────────────────────────────
const KNOWN_SKILLS = [
  // Programming Languages
  "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "C", "Go", "Golang", "Rust", "Ruby", "PHP",
  "Swift", "Kotlin", "Dart", "R", "SQL", "HTML", "HTML5", "CSS", "CSS3", "Bash", "Shell", "Solidity",
  "Scala", "Perl", "Haskell", "Lua", "MATLAB", "Assembly", "Elixir", "F#", "Julia",
  // Frameworks & Libraries
  "React", "React Native", "Next.js", "Node.js", "Express", "Vue", "Vue.js", "Angular", "Svelte",
  "Django", "Flask", "FastAPI", "Spring Boot", "ASP.NET", ".NET", "Laravel", "Ruby on Rails",
  "Tailwind CSS", "Bootstrap", "Redux", "GraphQL", "REST API", "gRPC", "WebSocket",
  "jQuery", "Three.js", "D3.js", "Electron", "NestJS",
  // Data Science, Analytics & AI
  "Machine Learning", "Deep Learning", "Artificial Intelligence", "AI", "TensorFlow", "PyTorch", "Keras",
  "scikit-learn", "Pandas", "NumPy", "OpenCV", "NLP", "Natural Language Processing", "LLM", "LLMs",
  "Computer Vision", "Data Analysis", "Data Analytics", "Data Science", "Tableau", "Power BI",
  "Apache Spark", "Kafka", "Hadoop", "Data Engineering",
  "Exploratory Data Analysis", "Data Visualization", "Predictive Analytics", "Predictive Modeling",
  "Forecasting", "Anomaly Detection", "Statistics", "Statistical Analysis", "Statistical Modeling",
  "A/B Testing", "Feature Engineering", "Model Evaluation", "Model Deployment",
  "Generative AI", "LLM Applications", "AI Agents", "Multi-Agent Systems", "Prompt Engineering",
  "Reinforcement Learning", "Transfer Learning", "Transformers", "BERT", "GPT",
  "Regression Analysis", "Classification", "Clustering", "Time Series Analysis",
  "Microsoft Excel", "Excel", "Google Sheets", "Looker",
  "Apache Airflow", "Databricks", "Snowflake", "BigQuery",
  "matplotlib", "Seaborn", "Plotly", "SciPy", "statsmodels",
  // Web Development
  "Web Development", "Full Stack Development", "Frontend Development", "Backend Development",
  "API Design", "API Development", "Responsive Design", "REST-oriented application concepts",
  // Cloud, DevOps & Tools
  "AWS", "Amazon Web Services", "Microsoft Azure", "Azure", "Google Cloud", "GCP",
  "Google Cloud Platform", "Docker", "Kubernetes", "CI/CD", "Terraform", "Ansible",
  "Linux", "Git", "GitHub", "GitLab", "Jenkins", "Prometheus", "Grafana",
  "Microservices", "Serverless", "Cloud Computing",
  // Databases
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "DynamoDB", "Oracle",
  "Cassandra", "Elasticsearch", "Firebase", "DBMS", "Database Management Systems",
  "NoSQL", "Database Design",
  // Blockchain & Security
  "Smart Contracts", "Ethereum", "Web3", "Hardhat", "Truffle", "IPFS", "Cryptography", "Cybersecurity",
  // Core Computer Science
  "Data Structures", "Algorithms", "Object-Oriented Programming", "OOP",
  "Operating Systems", "Computer Networks", "Networking", "System Design",
  "Distributed Systems", "Computer Architecture", "DBMS",
  "Problem Solving", "Competitive Programming", "Design Patterns",
  // Software Engineering
  "Agile", "Scrum", "Software Development", "Version Control", "Code Review",
  "Test-Driven Development", "TDD", "Unit Testing", "Integration Testing",
  "Software Architecture", "DevOps",
  // Design
  "UI/UX Design", "Figma", "Adobe XD", "Canva",
];

// ── Sanitize raw skill names ──────────────────────────────────────────────
function sanitizeSkillName(raw) {
  if (typeof raw !== "string") return null;
  let trimmed = raw.trim();

  // Strip leading/trailing punctuation like quotes, hyphens, brackets
  trimmed = trimmed.replace(/^[^a-zA-Z0-9+#]+|[^a-zA-Z0-9+#]+$/g, "").trim();

  if (trimmed.length < 2 || trimmed.length > 45) return null;

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) return null;

  const lower = trimmed.toLowerCase();

  // Reject PDF / bytecode tokens
  const pdfBlacklist = [
    "pdf", "obj", "endobj", "xref", "trailer", "stream", "endstream", "flatedecode",
    "mediabox", "catalog", "pages", "kids", "font", "type1", "metadata", "count",
    "parent", "resources", "procset", "asciihsl", "filter", "length", "type/pages"
  ];
  if (pdfBlacklist.some((bad) => lower === bad || lower.includes(` ${bad}`) || lower.includes(`${bad} `))) {
    return null;
  }

  // Reject PDF syntax characters
  if (/[%<>{}\[\]\\^~|]/.test(trimmed)) return null;

  // Reject PDF object notation (e.g. "1 0 obj", "3 0 R")
  if (/^\d+\s+\d+\s+(obj|r)$/i.test(trimmed)) return null;
  if (/^\d+\s+obj$/i.test(trimmed)) return null;

  // Reject resume section headers & non-skill terms
  const resumeNoise = [
    "education", "experience", "work experience", "summary", "profile", "objective",
    "projects", "personal projects", "certifications", "skills", "technical skills",
    "contact", "phone", "email", "address", "gpa", "bachelor", "master", "phd", "degree",
    "university", "college", "school", "high school", "resume", "curriculum vitae", "cv",
    "date", "present", "year", "month", "page", "declaration", "hobbies", "languages",
    "attached", "image", "file", "document"
  ];
  if (resumeNoise.includes(lower)) return null;

  return trimmed;
}

// ── Extract genuine skills from unstructured resume text ───────────────────
function extractSkillsFromUnstructuredText(text) {
  if (!text || typeof text !== "string") return [];
  const found = new Set();

  // If text looks like a comma/newline-separated skill list, parse each token directly.
  // Increased threshold to 4000 chars to handle full resume skill sections.
  const isSkillList = (text.length < 4000 && text.includes(",")) ||
    (text.length < 1500 && text.includes("\n"));

  if (isSkillList) {
    text.split(/[,\n]+/).forEach((item) => {
      const clean = sanitizeSkillName(item.trim());
      if (clean) found.add(clean);
    });
  }

  // ALWAYS scan against the full dictionary — catches skills anywhere in prose text too
  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp("(?:^|[^a-zA-Z0-9+#])" + escaped + "(?:$|[^a-zA-Z0-9+#])", "i");
    if (regex.test(text)) {
      found.add(skill);
    }
  }

  return Array.from(found);
}

// ── Normalize skill string to remove duplicate variants ──────────────────
function normalizeSkills(rawList) {
  const seen = new Set();
  return rawList
    .map(sanitizeSkillName)
    .filter(Boolean)
    .filter((s) => {
      const key = s.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// ── Detect domain from skill list ────────────────────────────────────────
function detectDomain(skillNames) {
  const sl = skillNames.map((s) => s.toLowerCase());
  if (sl.some((s) => ["python", "machine learning", "ml", "data science", "tensorflow", "pytorch",
    "pandas", "numpy", "scikit-learn", "deep learning", "nlp", "computer vision",
    "data analysis", "statistics", "tableau", "power bi", "r", "jupyter"].includes(s))) return "data";
  if (sl.some((s) => ["solidity", "web3", "blockchain", "ethereum", "smart contract",
    "defi", "nft", "hardhat", "truffle", "ipfs", "polygon", "chainlink"].includes(s))) return "blockchain";
  if (sl.some((s) => ["aws", "azure", "gcp", "docker", "kubernetes", "devops", "terraform",
    "ansible", "ci/cd", "jenkins", "prometheus", "grafana", "linux", "bash"].includes(s))) return "devops";
  if (sl.some((s) => ["react", "javascript", "typescript", "html", "css", "node", "vue",
    "angular", "next.js", "svelte", "express", "graphql", "rest api", "web"].includes(s))) return "web";
  if (sl.some((s) => ["java", "spring boot", "microservices", "kotlin", "scala", "hibernate",
    "maven", "gradle", "jvm"].includes(s))) return "java";
  if (sl.some((s) => ["c++", "c#", ".net", "unity", "unreal", "game development",
    "opengl", "directx"].includes(s))) return "systems";
  return "general";
}

// ── Rich mock responses (domain-specific) ────────────────────────────────
function buildMockResponse(skillsText, targetRole) {
  // Extract genuine technical skills from the document text
  const extracted = extractSkillsFromUnstructuredText(skillsText || "");
  const validSkillNames = normalizeSkills(extracted); // no cap — use all extracted skills

  const skills = validSkillNames.length
    ? validSkillNames.map((name) => ({ name, level: "intermediate" }))
    : [
        { name: "Programming", level: "intermediate" },
        { name: "Problem Solving", level: "intermediate" },
        { name: "Software Development", level: "beginner" }
      ];

  const domain = detectDomain(validSkillNames.length ? validSkillNames : ["programming"]);
  const topSkill = validSkillNames[0] || "Programming";

  let roles, gaps, roadmap;

  if (domain === "data" || (targetRole && /data|ml|machine|ai|scientist|analyst/i.test(targetRole))) {
    const target = targetRole || "ML Engineer";
    roles = [
      { role: "ML Engineer", fitScore: 88, why: "Strong alignment with ML and data skills.", matchingSkills: validSkillNames.filter(s => ["python", "machine learning", "tensorflow", "pytorch"].some(k => s.toLowerCase().includes(k))) },
      { role: "Data Scientist", fitScore: 85, why: "Core data science competencies detected.", matchingSkills: validSkillNames.filter(s => ["python", "statistics", "pandas", "r"].some(k => s.toLowerCase().includes(k))) },
      { role: "Data Analyst", fitScore: 79, why: "Strong analytical and visualization skills.", matchingSkills: validSkillNames.filter(s => ["sql", "excel", "tableau", "power bi"].some(k => s.toLowerCase().includes(k))) },
    ];
    gaps = [{
      targetRole: target,
      missingSkills: ["MLOps / model deployment", "Cloud ML platforms (AWS SageMaker / GCP Vertex AI)", "Model monitoring & evaluation", "Feature engineering at scale"],
      explanation: `To become a ${target}, you need to extend beyond model building into production deployment, cloud infrastructure, and continuous monitoring.`,
    }];
    roadmap = [
      {
        milestone: "Build an end-to-end ML pipeline",
        skill: "Machine Learning",
        description: "Design, train, and evaluate a complete ML model from raw data to prediction endpoint.",
        why: "End-to-end projects demonstrate production readiness and are the #1 thing interviewers look for.",
        durationWeeks: 3,
        tasks: [
          "Collect and clean a real dataset from Kaggle or UCI ML Repository",
          "Train a classification or regression model with scikit-learn or PyTorch",
          "Expose the model as a REST API using FastAPI and containerize with Docker",
        ],
        resources: [
          { title: "Kaggle Learn – Intro to ML", url: "https://www.kaggle.com/learn/intro-to-machine-learning" },
          { title: "FastAPI Official Docs", url: "https://fastapi.tiangolo.com/" },
        ],
        prerequisites: [],
      },
      {
        milestone: "Master MLOps fundamentals",
        skill: "MLOps",
        description: "Learn to version, track, and automate ML experiments in a reproducible way.",
        why: "MLOps skills are the single biggest gap between academic ML and production ML roles.",
        durationWeeks: 2,
        tasks: [
          "Set up MLflow or Weights & Biases to track 3 experiments",
          "Automate retraining with a GitHub Actions CI pipeline",
          "Store model artifacts and compare performance across runs",
        ],
        resources: [
          { title: "MLflow Getting Started", url: "https://mlflow.org/docs/latest/getting-started" },
          { title: "Weights & Biases Quickstart", url: "https://docs.wandb.ai/quickstart" },
        ],
        prerequisites: ["Build an end-to-end ML pipeline"],
      },
      {
        milestone: "Deploy a model to the cloud",
        skill: "Cloud ML Platforms",
        description: "Deploy a trained model to AWS SageMaker or GCP Vertex AI for scalable serving.",
        why: `${target} roles almost universally require cloud deployment experience.`,
        durationWeeks: 2,
        tasks: [
          "Create an AWS or GCP free-tier account and deploy a model endpoint",
          "Set up auto-scaling and monitor latency with CloudWatch or Cloud Monitoring",
          "Document the deployment architecture in a README",
        ],
        resources: [
          { title: "AWS SageMaker Developer Guide", url: "https://docs.aws.amazon.com/sagemaker/latest/dg/whatis.html" },
          { title: "GCP Vertex AI Quickstart", url: "https://cloud.google.com/vertex-ai/docs/start/introduction-unified-platform" },
        ],
        prerequisites: ["Master MLOps fundamentals"],
      },
      {
        milestone: "Complete a real-world dataset challenge",
        skill: "Feature Engineering",
        description: "Work on a Kaggle competition or open dataset to practice advanced feature engineering and model tuning.",
        why: "Competitions expose you to messy real-world data and force you to optimize model performance.",
        durationWeeks: 3,
        tasks: [
          "Join an active Kaggle competition in your domain",
          "Engineer at least 5 custom features and document their impact on model score",
          "Write a Kaggle notebook sharing your approach publicly",
        ],
        resources: [
          { title: "Kaggle Competitions", url: "https://www.kaggle.com/competitions" },
          { title: "Feature Engineering for ML (Udemy)", url: "https://www.udemy.com/course/feature-engineering-for-machine-learning/" },
        ],
        prerequisites: ["Build an end-to-end ML pipeline"],
      },
    ];
  } else if (domain === "blockchain") {
    roles = [
      { role: "Blockchain Developer", fitScore: 90, why: "Direct match with smart contract and Web3 skills.", matchingSkills: validSkillNames },
      { role: "DeFi Protocol Engineer", fitScore: 78, why: "Relevant for decentralised finance development.", matchingSkills: validSkillNames.filter(s => ["solidity", "defi"].some(k => s.toLowerCase().includes(k))) },
      { role: "Web3 Full-stack Developer", fitScore: 74, why: "Combination of blockchain and frontend skills.", matchingSkills: validSkillNames.filter(s => ["web3", "javascript", "react"].some(k => s.toLowerCase().includes(k))) },
    ];
    gaps = [{
      targetRole: targetRole || "Blockchain Developer",
      missingSkills: ["Smart contract security auditing", "Layer 2 protocols (Polygon, Arbitrum)", "Cross-chain bridges", "DeFi protocol design"],
      explanation: "Production blockchain roles require deep security knowledge and awareness of scaling solutions beyond Mainnet.",
    }];
    roadmap = [
      {
        milestone: "Complete smart contract security training",
        skill: "Smart Contract Security",
        description: "Identify and fix common vulnerabilities in Solidity smart contracts.",
        why: "Security exploits have cost the DeFi ecosystem billions. Employers expect developers to audit their own code.",
        durationWeeks: 2,
        tasks: [
          "Solve 10 challenges on Ethernaut (OpenZeppelin's wargame)",
          "Study the top 10 smart contract vulnerabilities (reentrancy, integer overflow, access control)",
          "Write a mock audit report for an open-source contract on GitHub",
        ],
        resources: [
          { title: "Ethernaut – Smart Contract Wargame", url: "https://ethernaut.openzeppelin.com/" },
          { title: "SWC Registry – Security Weaknesses", url: "https://swcregistry.io/" },
        ],
        prerequisites: [],
      },
      {
        milestone: "Build a full DeFi dApp",
        skill: "DeFi Development",
        description: "Create a working decentralised exchange or lending protocol from scratch.",
        why: "A deployed DeFi project is the single strongest portfolio piece for blockchain developer roles.",
        durationWeeks: 3,
        tasks: [
          "Design and deploy an AMM (Automated Market Maker) contract on Hardhat local network",
          "Build a React + ethers.js frontend that connects to MetaMask",
          "Deploy to a public testnet (Sepolia or Mumbai) and write a user guide",
        ],
        resources: [
          { title: "Hardhat Getting Started", url: "https://hardhat.org/tutorial" },
          { title: "Scaffold-ETH 2 Starter", url: "https://scaffoldeth.io/" },
        ],
        prerequisites: ["Complete smart contract security training"],
      },
    ];
  } else if (domain === "devops") {
    roles = [
      { role: "DevOps Engineer", fitScore: 87, why: "Cloud and infrastructure skills are a strong match.", matchingSkills: validSkillNames },
      { role: "Platform Engineer", fitScore: 82, why: "Container orchestration and CI/CD skills align well.", matchingSkills: validSkillNames.filter(s => ["kubernetes", "docker"].some(k => s.toLowerCase().includes(k))) },
      { role: "Site Reliability Engineer", fitScore: 78, why: "Monitoring and deployment experience is directly relevant.", matchingSkills: validSkillNames.filter(s => ["prometheus", "grafana", "linux"].some(k => s.toLowerCase().includes(k))) },
    ];
    gaps = [{
      targetRole: targetRole || "DevOps Engineer",
      missingSkills: ["Infrastructure as Code (Terraform)", "GitOps workflows (ArgoCD)", "Observability (Prometheus + Grafana)", "Service mesh (Istio / Linkerd)"],
      explanation: "Modern DevOps roles require infrastructure automation, GitOps practices, and full observability stacks.",
    }];
    roadmap = [
      {
        milestone: "Learn Infrastructure as Code with Terraform",
        skill: "Terraform",
        description: "Provision and manage cloud infrastructure declaratively using Terraform.",
        why: "IaC is a non-negotiable skill for senior DevOps and Platform Engineering roles.",
        durationWeeks: 2,
        tasks: [
          "Complete HashiCorp's official Terraform Getting Started tutorial",
          "Deploy a 3-tier application (VPC, EC2, RDS) on AWS using only Terraform",
          "Write a reusable Terraform module and publish it to a GitHub repo",
        ],
        resources: [
          { title: "HashiCorp Terraform Tutorials", url: "https://developer.hashicorp.com/terraform/tutorials" },
          { title: "Terraform Up & Running (book)", url: "https://www.terraformupandrunning.com/" },
        ],
        prerequisites: [],
      },
      {
        milestone: "Set up a full CI/CD pipeline",
        skill: "CI/CD",
        description: "Automate build, test, and deployment workflows with GitHub Actions or GitLab CI.",
        why: "Automated pipelines are the foundation of reliable software delivery.",
        durationWeeks: 2,
        tasks: [
          "Create a GitHub Actions workflow that builds, tests, and pushes a Docker image",
          "Add a staging deployment step with environment secrets management",
          "Implement rollback on failed deployments",
        ],
        resources: [
          { title: "GitHub Actions Documentation", url: "https://docs.github.com/en/actions" },
          { title: "GitLab CI/CD Quickstart", url: "https://docs.gitlab.com/ee/ci/quick_start/" },
        ],
        prerequisites: ["Learn Infrastructure as Code with Terraform"],
      },
      {
        milestone: "Master Kubernetes orchestration",
        skill: "Kubernetes",
        description: "Deploy, scale, and manage containerised applications on Kubernetes.",
        why: "Kubernetes is the de facto standard for production container orchestration.",
        durationWeeks: 3,
        tasks: [
          "Complete the Kubernetes official interactive tutorial",
          "Deploy a microservices application to a local Kind or Minikube cluster",
          "Configure HPA (Horizontal Pod Autoscaler) and test under load with k6",
        ],
        resources: [
          { title: "Kubernetes Official Tutorials", url: "https://kubernetes.io/docs/tutorials/" },
          { title: "Play with Kubernetes (interactive)", url: "https://labs.play-with-k8s.com/" },
        ],
        prerequisites: ["Set up a full CI/CD pipeline"],
      },
    ];
  } else if (domain === "web") {
    roles = [
      { role: "Full-stack Developer", fitScore: 87, why: "Combination of frontend and backend web skills.", matchingSkills: validSkillNames },
      { role: "Frontend Engineer", fitScore: 84, why: "Strong React and TypeScript skills detected.", matchingSkills: validSkillNames.filter(s => ["react", "typescript", "css", "html"].some(k => s.toLowerCase().includes(k))) },
      { role: "Backend Engineer", fitScore: 76, why: "Node.js and API design skills align with backend roles.", matchingSkills: validSkillNames.filter(s => ["node", "express", "sql", "rest"].some(k => s.toLowerCase().includes(k))) },
    ];
    gaps = [{
      targetRole: targetRole || "Full-stack Developer",
      missingSkills: ["Database design (SQL + NoSQL)", "Authentication & security (JWT, OAuth2)", "System design & scalability", "Testing strategy (unit, integration, E2E)"],
      explanation: "Full-stack roles require both frontend proficiency and solid backend foundations including databases, auth, and testing.",
    }];
    roadmap = [
      {
        milestone: "Build a full-stack authenticated app",
        skill: "Full-stack Development",
        description: "Create a complete web application with user authentication, database, and REST API.",
        why: "Authenticated CRUD apps demonstrate the full breadth of full-stack skills in a single project.",
        durationWeeks: 3,
        tasks: [
          "Build a Next.js app with server-side rendering and a PostgreSQL database",
          "Implement JWT authentication with refresh tokens and secure cookies",
          "Write integration tests for all API routes using Jest + Supertest",
        ],
        resources: [
          { title: "Next.js Official Docs", url: "https://nextjs.org/docs" },
          { title: "Auth.js (NextAuth) Documentation", url: "https://authjs.dev/" },
        ],
        prerequisites: [],
      },
      {
        milestone: "Master database design and optimization",
        skill: "Database Design",
        description: "Design normalized schemas, write efficient queries, and use both SQL and NoSQL databases.",
        why: "Database performance is a critical differentiator between junior and senior developers.",
        durationWeeks: 2,
        tasks: [
          "Design and implement a normalized schema for a social platform (users, posts, likes)",
          "Add indexes and analyze query performance using EXPLAIN in PostgreSQL",
          "Add Redis caching for 3 high-traffic endpoints and measure the speed improvement",
        ],
        resources: [
          { title: "PostgreSQL Tutorial", url: "https://www.postgresql.org/docs/current/tutorial.html" },
          { title: "Use The Index, Luke (query optimization)", url: "https://use-the-index-luke.com/" },
        ],
        prerequisites: ["Build a full-stack authenticated app"],
      },
      {
        milestone: "Study system design fundamentals",
        skill: "System Design",
        description: "Learn to design scalable, fault-tolerant distributed systems from first principles.",
        why: "System design interviews are the gateway to senior developer roles at any company.",
        durationWeeks: 2,
        tasks: [
          "Study load balancing, caching strategies, and database sharding concepts",
          "Design a URL shortener system with capacity estimation (write it up on paper)",
          "Watch 5 system design videos on YouTube (NeetCode, System Design Interview channel)",
        ],
        resources: [
          { title: "System Design Primer (GitHub)", url: "https://github.com/donnemartin/system-design-primer" },
          { title: "Designing Data-Intensive Applications (book)", url: "https://dataintensive.net/" },
        ],
        prerequisites: ["Master database design and optimization"],
      },
    ];
  } else {
    // General / mixed domain
    roles = [
      { role: "Software Engineer", fitScore: 75, why: `${topSkill} is broadly applicable to engineering roles.`, matchingSkills: validSkillNames.slice(0, 2) },
      { role: "Technical Analyst", fitScore: 70, why: "Analytical and technical skills match this role.", matchingSkills: validSkillNames.slice(0, 1) },
      { role: "Technology Consultant", fitScore: 65, why: "Cross-domain skills are valued in consulting.", matchingSkills: validSkillNames.slice(0, 2) },
    ];
    gaps = [{
      targetRole: targetRole || "Software Engineer",
      missingSkills: ["Data structures & algorithms", "System design principles", "Version control & collaboration (Git)", "Testing & code quality"],
      explanation: "Software engineering roles require strong CS fundamentals in addition to domain-specific knowledge.",
    }];
    roadmap = [
      {
        milestone: `Deepen expertise in ${topSkill}`,
        skill: topSkill,
        description: `Build a complete, production-ready project that showcases ${topSkill} from design to deployment.`,
        why: "Deep expertise in at least one area is the fastest path to employability.",
        durationWeeks: 3,
        tasks: [
          `Build a portfolio project using ${topSkill} that solves a real problem`,
          "Write a technical blog post explaining your approach and key learnings",
          "Get code reviewed on GitHub or in a developer community (e.g., CodeReview Stack Exchange)",
        ],
        resources: [
          { title: "GitHub Skills", url: "https://skills.github.com/" },
          { title: "freeCodeCamp", url: "https://www.freecodecamp.org/" },
        ],
        prerequisites: [],
      },
      {
        milestone: "Learn data structures & algorithms",
        skill: "Algorithms",
        description: "Develop strong problem-solving skills with core data structures and algorithmic patterns.",
        why: "Technical interviews at most companies include DSA questions regardless of your specialization.",
        durationWeeks: 3,
        tasks: [
          "Solve 30 LeetCode problems (10 Easy, 15 Medium, 5 Hard) across arrays, strings, trees, graphs",
          "Implement a hash map, binary search tree, and graph from scratch in your preferred language",
          "Practice timed coding sessions (45 minutes per problem) to simulate interviews",
        ],
        resources: [
          { title: "LeetCode", url: "https://leetcode.com/" },
          { title: "NeetCode 150 Roadmap", url: "https://neetcode.io/roadmap" },
        ],
        prerequisites: [],
      },
      {
        milestone: "Build a portfolio and practice Git collaboration",
        skill: "Version Control",
        description: "Create a strong GitHub presence with well-documented projects and learn collaborative workflows.",
        why: "Most job applications expect a portfolio GitHub profile. Recruiters check it before the interview.",
        durationWeeks: 2,
        tasks: [
          "Create or polish 3 GitHub repositories with proper README, architecture diagrams, and setup instructions",
          "Practice Git branching, pull requests, and code reviews using a team workflow",
          "Deploy at least one project to a live URL (Vercel, Netlify, Render, or Railway)",
        ],
        resources: [
          { title: "GitHub Docs – Collaborating", url: "https://docs.github.com/en/pull-requests" },
          { title: "Pro Git Book (free)", url: "https://git-scm.com/book/en/v2" },
        ],
        prerequisites: [`Deepen expertise in ${topSkill}`],
      },
    ];
  }

  return { skills, careerRecommendations: roles, skillGaps: gaps, roadmap, _mock: true };
}

// ── Main career engine ────────────────────────────────────────────────────
async function runCareerEngine(skillsText, base64Image, targetRole) {
  const safeText = skillsText && !skillsText.startsWith("[Image") ? skillsText.trim() : "";

  if (!config.groqApiKey) {
    console.log("No Groq API key — using mock AI response.");
    return buildMockResponse(safeText, targetRole);
  }

  const client = new Groq({ apiKey: config.groqApiKey });

  try {
    // ── Vision path: extract skills from image ──
    if (base64Image) {
      let extractedNames = [];
      try {
        const visionCompletion = await client.chat.completions.create({
          model: VISION_MODEL,
          temperature: 0.1,
          messages: [
            { role: "system", content: VISION_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all skills from this document image. Return only a JSON array." },
                { type: "image_url", image_url: { url: base64Image } },
              ],
            },
          ],
          max_tokens: 600,
        });

        const raw = (visionCompletion.choices?.[0]?.message?.content || "[]").trim();
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            extractedNames = parsed.filter((s) => typeof s === "string" && s.trim().length > 1);
          } else if (parsed.skills && Array.isArray(parsed.skills)) {
            extractedNames = parsed.skills.map((s) => (typeof s === "string" ? s : s.name)).filter(Boolean);
          }
        } catch {
          const arrMatch = raw.match(/\[([^\]]+)\]/);
          if (arrMatch) {
            extractedNames = arrMatch[1].split(",").map((s) => s.replace(/['"]/g, "").trim()).filter(Boolean);
          }
        }
      } catch (visionErr) {
        console.error("Vision model error:", visionErr.message, "— falling back to text model");
      }

      if (extractedNames.length > 0) {
        const validSkills = normalizeSkills(extractedNames); // no cap — use all extracted skills
        console.log("Vision extracted skills:", validSkills.join(", "));
        return runCareerEngine(validSkills.join(", "), null, targetRole);
      }

      return buildMockResponse(null, targetRole);
    }

    // ── Text path: full career analysis ──
    const modelInput = safeText || "General programming skills";
    // Always run dictionary extraction on the raw text — catches what AI might miss
    const dictionarySkills = extractSkillsFromUnstructuredText(safeText);

    const userMessage = targetRole
      ? `Student's resume text or skill list:\n${modelInput}\n\nTarget career role: ${targetRole}`
      : `Student's resume text or skill list:\n${modelInput}`;

    const completion = await client.chat.completions.create({
      model: config.groqModel || TEXT_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CAREER_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1500, // balanced: enough for full skill list + roadmap, within llama limits
    });

    const raw = (completion.choices?.[0]?.message?.content || "{}").trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error("JSON parse error from Groq:", parseErr.message, "— raw:", raw.substring(0, 200));
      return buildMockResponse(safeText, targetRole);
    }

    // Sanitize skill names in AI response
    if (parsed.skills && Array.isArray(parsed.skills)) {
      parsed.skills = parsed.skills
        .map((s) => ({ ...s, name: sanitizeSkillName(typeof s === "string" ? s : s.name) }))
        .filter((s) => s.name);
    }

    // ALWAYS merge AI output with dictionary extraction — union of both for maximum coverage
    // This ensures no skill is missed regardless of AI accuracy
    const aiSkillNames = new Set((parsed.skills || []).map((s) => s.name?.toLowerCase()));
    const mergedSkills = [...(parsed.skills || [])]; // start with AI skills
    for (const dictSkill of dictionarySkills) {
      if (!aiSkillNames.has(dictSkill.toLowerCase())) {
        mergedSkills.push({ name: dictSkill, level: "intermediate" });
      }
    }
    if (mergedSkills.length > 0) {
      parsed.skills = mergedSkills;
    }

    // If still no skills at all, use dictionary skills only
    if (!parsed.skills || parsed.skills.length === 0) {
      parsed.skills = normalizeSkills(dictionarySkills).map((name) => ({ name, level: "intermediate" }));
    }

    // Ensure roadmap items all start unchecked
    if (parsed.roadmap && Array.isArray(parsed.roadmap)) {
      parsed.roadmap = parsed.roadmap.map((rm) => ({
        ...rm,
        tasks: Array.isArray(rm.tasks) ? rm.tasks : [],
        resources: Array.isArray(rm.resources) ? rm.resources : [],
        prerequisites: Array.isArray(rm.prerequisites) ? rm.prerequisites : [],
      }));
    }

    return parsed;
  } catch (err) {
    console.error("Groq API error:", err.message);
    console.log("Falling back to mock AI response.");
    return buildMockResponse(safeText, targetRole);
  }
}

module.exports = { runCareerEngine, sanitizeSkillName, normalizeSkills, extractSkillsFromUnstructuredText };
