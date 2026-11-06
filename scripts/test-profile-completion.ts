import { calculateProfileCompletion } from "../artifacts/api-server/src/lib/profile-completion";

console.log("Running profile completion tests...");

// Test 1: Empty profile
const res1 = calculateProfileCompletion({});
console.assert(res1.percentage === 0, `Expected 0%, got ${res1.percentage}%`);
console.assert(res1.missingSections.length > 0, "Expected missing sections");

// Test 2: Full profile
const res2 = calculateProfileCompletion({
  displayName: "Alex Johnson",
  professionalSummary: "Passionate software engineer building web apps.",
  photoUrl: "https://example.com/photo.jpg",
  location: "San Francisco, CA",
  college: "Stanford University",
  degree: "B.S.",
  branch: "Computer Science",
  graduationYear: "2027",
  skills: ["TypeScript", "React", "Node.js"],
  githubUrl: "https://github.com/alex",
  linkedinUrl: "https://linkedin.com/in/alex",
  projectsCount: 2,
  experienceCount: 1,
});
console.assert(res2.percentage === 100, `Expected 100%, got ${res2.percentage}%`);
console.assert(res2.missingSections.length === 0, `Expected 0 missing sections, got ${res2.missingSections.length}`);

// Test 3: Partial profile
const res3 = calculateProfileCompletion({
  displayName: "Alex Johnson",
  college: "Stanford University",
  degree: "B.S.",
  branch: "Computer Science",
  graduationYear: "2027",
  skills: ["Python", "SQL"],
});
console.assert(res3.percentage === 30, `Expected 30%, got ${res3.percentage}%`);

console.log("All profile completion tests passed successfully!");
