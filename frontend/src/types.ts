export type Status = 'verified' | 'active' | 'pending' | 'revoked' | 'simulated'

export type Credential = {
  id: string
  type: string
  issuer: string
  issuerDid: string
  issued: string
  expires: string
  status: Status
  claims: string[]
}

export type WorkflowPhase = {
  id: number
  eyebrow: string
  title: string
  description: string
  state: 'complete' | 'current' | 'upcoming'
  detail: string
  actionPath?: string
  actionLabel?: string
}

export type ProofRequest = {
  id: string
  from: string
  role: string
  requestedClaim: string
  expires: string
  status: 'pending' | 'approved' | 'declined'
}

export type Resource = {
  title: string
  url: string
}

export type RoadmapItem = {
  id: string
  title: string
  skill: string
  detail: string
  why: string
  durationWeeks: number
  tasks: string[]
  resources: Resource[]
  prerequisites: string[]
  status: 'done' | 'next' | 'later'
}

export type Gap = {
  skill: string
  priority: 'High' | 'Medium' | 'Low'
  action: string
  explanation?: string
  missingSkills?: string[]
}

export type Recommendation = {
  role: string
  fit: string
  reason: string
  matchingSkills?: string[]
}

export type PassportData = {
  holder: { name: string; did: string; network: string }
  credentials: Credential[]
  workflow: WorkflowPhase[]
  skills: string[]
  recommendations: Recommendation[]
  gaps: Gap[]
  roadmap: RoadmapItem[]
  proofRequest: ProofRequest | null
  targetRole?: string | null
  isAiGenerated?: boolean
}

export type ProofDecision = 'approved' | 'declined'

export interface ProofPassApi {
  getPassport(): Promise<PassportData>
  decideProofRequest(id: string, decision: ProofDecision): Promise<ProofRequest>
  toggleRoadmapItem(id: string): Promise<void>
  scanDocument(text: string, image?: string, fileData?: string, fileName?: string, fileType?: string): Promise<void>
  verifySkill(address: string, skill: string): Promise<boolean>
  requestProof(address: string, skill: string): Promise<void>
  checkProofRequest(): Promise<{ status: string, report?: string }>
  setCareerGoal(role: string): Promise<void>
  regenerateRoadmap(targetRole?: string): Promise<{ roadmap: RoadmapItem[], recommendations: Recommendation[], gaps: Gap[], targetRole: string | null, aiMock: boolean }>
  resetWallet(): Promise<void>
}
