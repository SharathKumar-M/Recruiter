export interface GitHubVerificationResult {
  verified: boolean | null;
  status: "AUTHENTIC" | "NOT_FOUND" | "RATE_LIMITED" | "UNREACHABLE" | "INVALID_URL" | "NOT_PROVIDED";
  username?: string;
  detail: string;
  publicRepos?: number;
  followers?: number;
  topLanguages?: string[];
  topRepos?: Array<{
    name: string;
    language: string | null;
    stars: number;
    description: string | null;
    updatedAt: string;
  }>;
}

export function extractGitHubUsername(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export async function verifyGitHubProfile(githubUrl?: string | null): Promise<GitHubVerificationResult> {
  if (!githubUrl || !githubUrl.trim()) {
    return {
      verified: false,
      status: "NOT_PROVIDED",
      detail: "No GitHub profile link was provided by the candidate.",
    };
  }

  const username = extractGitHubUsername(githubUrl);
  if (!username) {
    return {
      verified: false,
      status: "INVALID_URL",
      detail: `Supplied GitHub link "${githubUrl}" does not match standard GitHub profile format.`,
    };
  }

  const headers: Record<string, string> = {
    "User-Agent": "VERIF-AI-Portal/1.0",
    Accept: "application/vnd.github.v3+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (userRes.status === 404) {
      return {
        verified: false,
        status: "NOT_FOUND",
        username,
        detail: `GitHub account "@${username}" does not exist on GitHub.`,
      };
    }

    if (userRes.status === 403) {
      return {
        verified: null,
        status: "RATE_LIMITED",
        username,
        detail: `GitHub public API rate limit reached. Profile URL format is valid for "@${username}".`,
      };
    }

    if (!userRes.ok) {
      return {
        verified: null,
        status: "UNREACHABLE",
        username,
        detail: `GitHub API returned HTTP ${userRes.status}.`,
      };
    }

    const userData = (await userRes.json()) as any;

    // Fetch top public repos
    let topRepos: Array<{ name: string; language: string | null; stars: number; description: string | null; updatedAt: string }> = [];
    const languageSet = new Set<string>();

    try {
      const reposController = new AbortController();
      const reposTimeout = setTimeout(() => reposController.abort(), 6000);

      const reposRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=6`,
        { headers, signal: reposController.signal }
      );
      clearTimeout(reposTimeout);

      if (reposRes.ok) {
        const reposData = (await reposRes.json()) as any[];
        if (Array.isArray(reposData)) {
          topRepos = reposData.map((r) => {
            if (r.language) languageSet.add(r.language);
            return {
              name: r.name,
              language: r.language ?? null,
              stars: r.stargazers_count ?? 0,
              description: r.description ?? null,
              updatedAt: r.updated_at,
            };
          });
        }
      }
    } catch {
      // Repos fetch optional
    }

    const publicRepos = userData.public_repos ?? 0;
    const followers = userData.followers ?? 0;
    const topLanguages = Array.from(languageSet);

    return {
      verified: true,
      status: "AUTHENTIC",
      username,
      publicRepos,
      followers,
      topLanguages,
      topRepos,
      detail: `Verified GitHub user "@${username}" with ${publicRepos} public repository/repositories and ${followers} follower(s). Active stacks: ${topLanguages.join(", ") || "None specified"}.`,
    };
  } catch (err: any) {
    return {
      verified: null,
      status: "UNREACHABLE",
      username,
      detail: `Network error verifying GitHub profile: ${err.message || String(err)}`,
    };
  }
}

export function verifyUrlSyntax(url?: string | null): { valid: boolean; protocol?: string } {
  if (!url) return { valid: false };
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return { valid: parsed.protocol === "http:" || parsed.protocol === "https:", protocol: parsed.protocol };
  } catch {
    return { valid: false };
  }
}
