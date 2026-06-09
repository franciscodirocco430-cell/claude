// Matching v1 — skill overlap scoring. Replace with ML embeddings in V2.

interface FreeloProp {
  skills: string[];
  xp_score: number;
  availability: string;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  categories?: string[];
}

interface ProjectProp {
  required_skills: string[];
  budget_min?: number;
  budget_max?: number;
  category?: string;
}

export function calculateMatchScore(freelo: FreeloProp, project: ProjectProp): number {
  let score = 0;

  // Skill overlap (0-60 pts)
  const freeloSkillsLower = freelo.skills.map((s) => s.toLowerCase());
  const projectSkillsLower = (project.required_skills ?? []).map((s) => s.toLowerCase());
  if (projectSkillsLower.length > 0) {
    const matched = freeloSkillsLower.filter((s) => projectSkillsLower.includes(s));
    score += (matched.length / projectSkillsLower.length) * 60;
  } else {
    score += 30;
  }

  // XP bonus (0-20 pts)
  score += Math.min(freelo.xp_score / 50, 20);

  // Availability bonus (0-10 pts)
  if (freelo.availability === "available") score += 10;
  else if (freelo.availability === "open_to_offers") score += 5;

  // Rate fit (0-10 pts)
  if (project.budget_max && freelo.hourly_rate_min) {
    if (freelo.hourly_rate_min <= project.budget_max) score += 10;
    else if (freelo.hourly_rate_min <= project.budget_max * 1.2) score += 5;
  } else {
    score += 5;
  }

  return Math.min(Math.round(score), 100);
}
