import { execSync } from 'node:child_process';
import fs from 'node:fs';

const outputPath = process.env.LINEAR_UPDATE_BODY_PATH ?? '/tmp/collag-io-update.md';
const projectName = process.env.LINEAR_PROJECT_NAME ?? 'Collag-io';
const range = process.env.LINEAR_UPDATE_RANGE;
const commitCount = Number(process.env.LINEAR_UPDATE_COMMIT_COUNT ?? '15');
const health = process.env.LINEAR_UPDATE_HEALTH ?? 'onTrack';

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function getCommitLines() {
  if (range && range.trim().length > 0) {
    const out = run(`git log --oneline ${range}`);
    return out ? out.split('\n').filter(Boolean) : [];
  }

  const out = run(`git log --oneline -n ${Number.isFinite(commitCount) ? commitCount : 15}`);
  return out ? out.split('\n').filter(Boolean) : [];
}

function classify(subject) {
  const text = subject.toLowerCase();
  const tags = new Set();

  if (/(feat|add|introduce|implement|create|enhance)/.test(text)) tags.add('features');
  if (/(fix|bug|regression|persist|hydrate|restore)/.test(text)) tags.add('reliability');
  if (/(ui|style|theme|drawer|overlay|canvas|scroll|navigation|layout)/.test(text)) tags.add('ux');
  if (/(refactor|docs|mcp|linear|architecture|chore)/.test(text)) tags.add('platform');

  if (tags.size === 0) tags.add('features');
  return [...tags];
}

function normalizeSubject(subject) {
  return subject
    .replace(/^feat:\s*/i, '')
    .replace(/^fix:\s*/i, '')
    .replace(/^refactor:\s*/i, '')
    .replace(/^style:\s*/i, '')
    .replace(/^chore:\s*/i, '')
    .trim();
}

function firstLineByCategory(commits, category) {
  const items = commits.filter((c) => c.tags.includes(category)).slice(0, 4);
  return items.map((c) => `- ${normalizeSubject(c.subject)}`);
}

function unique(list) {
  return [...new Set(list)];
}

const commitLines = getCommitLines();
if (commitLines.length === 0) {
  console.error('No commits found for provided range.');
  process.exit(1);
}

const commits = commitLines.map((line) => {
  const [hash, ...parts] = line.split(' ');
  const subject = parts.join(' ').trim();
  return {
    hash,
    subject,
    tags: classify(subject),
  };
});

const newest = commits[0]?.hash;
const oldest = commits[commits.length - 1]?.hash;

const delivered = unique([
  ...firstLineByCategory(commits, 'features'),
  ...firstLineByCategory(commits, 'ux'),
  ...firstLineByCategory(commits, 'reliability'),
]);

const milestones = [];
if (commits.some((c) => c.tags.includes('ux'))) {
  milestones.push('- Editing UX and navigation improvements shipped across canvas and controls.');
}
if (commits.some((c) => c.tags.includes('reliability'))) {
  milestones.push('- Reliability and persistence hardening updates were delivered.');
}
if (commits.some((c) => c.tags.includes('platform'))) {
  milestones.push('- Platform/documentation workflows were improved for repeatable delivery.');
}
if (commits.some((c) => c.tags.includes('features'))) {
  milestones.push('- New capabilities were added to image workflow and project usability.');
}

const commitPreview = commits.slice(0, 10).map((c) => `- ${c.hash} ${c.subject}`);
const generatedAt = new Date().toISOString();

const body = `## Project Update - ${projectName}\n\n### Summary\nRecent work focused on improving usability, reliability, and delivery flow in ${projectName}. This update is generated from repository commit history and grouped by milestones.\n\n### Health\n- ${health}\n\n### Delivered\n${delivered.join('\n') || '- Ongoing improvements recorded in commit history.'}\n\n### Milestones\n${milestones.join('\n') || '- Milestone grouping pending further commit activity.'}\n\n### Risks / Follow-ups\n- Continue monitoring persistence and hydration behavior after UI interaction changes.\n- Track bundle growth as UI/animation capabilities expand.\n- Add regression checks around multi-page canvas workflows.\n\n### Next\n- Continue milestone-linked documentation in Linear updates.\n- Prioritize batching and preset workflows for image enhancement/export flows.\n- Keep commit-to-milestone traceability explicit in future updates.\n\n### Commit Coverage\n- Range: ${oldest}..${newest}\n- Count: ${commits.length}\n- Generated: ${generatedAt}\n\n### Recent Commits\n${commitPreview.join('\n')}\n`;

fs.writeFileSync(outputPath, body);

console.log(`Generated Linear update body at: ${outputPath}`);
console.log(`Commit coverage: ${oldest}..${newest} (${commits.length} commits)`);
