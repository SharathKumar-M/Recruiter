/**
 * Computes the profile completion percentage and missing sections (next steps)
 * for a student profile based on a deterministic, weighted rule.
 *
 * Weighted Rule:
 * - Personal Information (Name 10%, Summary 5%, Photo 5%, Location 5%): Total 25%
 * - Education (College 5%, Degree 5%, Branch 5%, Graduation Year 5%): Total 20%
 * - Skills (At least 3 skills across categories): Total 20%
 * - Professional Links (At least 1 link - GitHub/LinkedIn/Portfolio): Total 10%
 * - Projects (At least 1 project): Total 15%
 * - Experience or Certificates (At least 1 experience item or certificate): Total 10%
 *
 * Note: Profile completion is strictly a UX indicator and never sets or influences verified status.
 */

export interface ProfileCompletionInput {
  displayName?: string | null;
  professionalSummary?: string | null;
  photoUrl?: string | null;
  location?: string | null;
  college?: string | null;
  degree?: string | null;
  branch?: string | null;
  graduationYear?: string | null;
  skills?: string[] | null;
  programmingLanguages?: string[] | null;
  frameworks?: string[] | null;
  databases?: string[] | null;
  tools?: string[] | null;
  otherSkills?: string[] | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  projectsCount?: number;
  experienceCount?: number;
  certificatesCount?: number;
}

export interface ProfileCompletionResult {
  percentage: number;
  missingSections: string[];
}

export function calculateProfileCompletion(profile: ProfileCompletionInput): ProfileCompletionResult {
  let score = 0;
  const missing: string[] = [];

  // 1. Personal Information (25%)
  let personalScore = 0;
  if (profile.displayName && profile.displayName.trim().length > 0) personalScore += 10;
  if (profile.professionalSummary && profile.professionalSummary.trim().length >= 10) personalScore += 5;
  if (profile.photoUrl && profile.photoUrl.trim().length > 0) personalScore += 5;
  if (profile.location && profile.location.trim().length > 0) personalScore += 5;

  score += personalScore;
  if (personalScore < 25) {
    missing.push("Personal Information (Add full name, summary, photo, and location)");
  }

  // 2. Education (20%)
  let educationScore = 0;
  if (profile.college && profile.college.trim().length > 0) educationScore += 5;
  if (profile.degree && profile.degree.trim().length > 0) educationScore += 5;
  if (profile.branch && profile.branch.trim().length > 0) educationScore += 5;
  if (profile.graduationYear && profile.graduationYear.trim().length > 0) educationScore += 5;

  score += educationScore;
  if (educationScore < 20) {
    missing.push("Education Background (Add college, degree, branch, and graduation year)");
  }

  // 3. Skills (20%)
  const totalSkills = Array.from(new Set([
    ...(profile.skills ?? []),
    ...(profile.programmingLanguages ?? []),
    ...(profile.frameworks ?? []),
    ...(profile.databases ?? []),
    ...(profile.tools ?? []),
    ...(profile.otherSkills ?? []),
  ])).length;

  if (totalSkills >= 3) {
    score += 20;
  } else {
    missing.push("Skills (Add at least 3 technical skills or languages)");
  }

  // 4. Professional Links (10%)
  const hasLinks = Boolean(
    (profile.githubUrl && profile.githubUrl.trim()) ||
    (profile.linkedinUrl && profile.linkedinUrl.trim()) ||
    (profile.portfolioUrl && profile.portfolioUrl.trim())
  );
  if (hasLinks) {
    score += 10;
  } else {
    missing.push("Professional Links (Add GitHub, LinkedIn, or Portfolio URL)");
  }

  // 5. Projects (15%)
  const projectsCount = profile.projectsCount ?? 0;
  if (projectsCount >= 1) {
    score += 15;
  } else {
    missing.push("Projects (Add at least one standout project)");
  }

  // 6. Experience or Certificates (10%)
  const expCount = profile.experienceCount ?? 0;
  const certCount = profile.certificatesCount ?? 0;
  if (expCount >= 1 || certCount >= 1) {
    score += 10;
  } else {
    missing.push("Experience or Certificates (Add work experience or certifications)");
  }

  return {
    percentage: Math.min(100, Math.max(0, score)),
    missingSections: missing,
  };
}
