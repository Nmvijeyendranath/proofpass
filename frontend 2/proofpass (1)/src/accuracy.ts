import type { PassportData } from './types'

export type AccuracySource = 'verified' | 'simulated' | 'mixed' | 'none'

export type AccuracySnapshot = {
  matchedSkills: number
  totalSkills: number
  percentage: number
  source: AccuracySource
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Measures exact profile-to-evidence coverage, not AI or real-world accuracy.
 * Only verified and explicitly simulated credential claims are eligible.
 */
export function calculateAccuracy(data: Pick<PassportData, 'skills' | 'credentials'>): AccuracySnapshot {
  const skills = [...new Set(data.skills.map(normalize).filter(Boolean))]
  const eligibleCredentials = data.credentials.filter((credential) => credential.status === 'verified' || credential.status === 'simulated')
  const claims = new Set(eligibleCredentials.flatMap((credential) => credential.claims.map(normalize).filter(Boolean)))
  const matchedSkills = skills.filter((skill) => claims.has(skill)).length
  const verifiedCount = eligibleCredentials.filter((credential) => credential.status === 'verified').length
  const simulatedCount = eligibleCredentials.filter((credential) => credential.status === 'simulated').length
  const source: AccuracySource = verifiedCount && simulatedCount ? 'mixed' : verifiedCount ? 'verified' : simulatedCount ? 'simulated' : 'none'

  return {
    matchedSkills,
    totalSkills: skills.length,
    percentage: skills.length ? Math.round((matchedSkills / skills.length) * 100) : 0,
    source,
  }
}
