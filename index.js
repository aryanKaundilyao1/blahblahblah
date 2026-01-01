#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Determine repository root directory
function findRepoRoot() {
  const candidates = [
    __dirname,
    process.cwd(),
    path.join(__dirname, 'blahblahblah'),
    path.join(process.cwd(), 'blahblahblah')
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
  }
  return __dirname;
}

const REPO_DIR = findRepoRoot();
const DATES_FILE = path.join(REPO_DIR, 'dates.json');
const DATA_FILE = path.join(REPO_DIR, 'data.json');

// Helper to run git commands in the repo directory
function runGit(command, envVars = {}) {
  return execSync(command, {
    cwd: REPO_DIR,
    env: { ...process.env, ...envVars },
    stdio: 'pipe'
  }).toString().trim();
}

// Ensure git identity is configured
function ensureGitConfig() {
  try {
    const email = runGit('git config user.email');
    if (!email) throw new Error('No email');
  } catch {
    console.log('[i] Setting git author configuration to Aryan Kaundilya <aryankaundilya.jas@gmail.com>...');
    runGit('git config user.name "Aryan Kaundilya"');
    runGit('git config user.email "aryankaundilya.jas@gmail.com"');
  }
}

// Generate random daytime ISO timestamp for a date
function toIsoTimestamp(dateInput, commitIndex = 0) {
  let baseDate;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    // Random hour between 9 AM and 9 PM
    const hour = 9 + ((commitIndex * 2 + Math.floor(Math.random() * 3)) % 12);
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    baseDate = new Date(year, month - 1, day, hour, minute, second);
  } else {
    baseDate = new Date(dateInput);
  }

  // Format as YYYY-MM-DDTHH:mm:ss
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = baseDate.getFullYear();
  const mm = pad(baseDate.getMonth() + 1);
  const dd = pad(baseDate.getDate());
  const hh = pad(baseDate.getHours());
  const mi = pad(baseDate.getMinutes());
  const ss = pad(baseDate.getSeconds());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

// Read dates from dates.json
function loadDates() {
  if (!fs.existsSync(DATES_FILE)) {
    const defaultData = {
      description: "Log your desired commit dates in YYYY-MM-DD format (target: ~15-20 commits/month).",
      dates: []
    };
    fs.writeFileSync(DATES_FILE, JSON.stringify(defaultData, null, 2));
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(DATES_FILE, 'utf-8'));
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.dates)) return raw.dates;
    return [];
  } catch (err) {
    console.error(`[!] Error parsing ${DATES_FILE}:`, err.message);
    return [];
  }
}

// Save dates array to dates.json
function saveDates(dates) {
  const data = {
    description: "Log your desired commit dates below in YYYY-MM-DD format (target: ~15-20 commits/month).",
    dates
  };
  fs.writeFileSync(DATES_FILE, JSON.stringify(data, null, 2));
}

// Read or initialize data.json
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { totalCommits: 0, lastCommit: null, lastUpdated: new Date().toISOString() };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return { totalCommits: 0, lastCommit: null, lastUpdated: new Date().toISOString() };
  }
}

// Perform a single backdated commit
function makeCommit(dateStr, index = 0) {
  const timestamp = toIsoTimestamp(dateStr, index);
  const data = loadData();

  data.totalCommits = (data.totalCommits || 0) + 1;
  data.lastCommit = timestamp;
  data.lastUpdated = new Date().toISOString();

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  runGit('git add -A');
  runGit(`git commit -m "Contribution update: ${timestamp}"`, {
    GIT_AUTHOR_DATE: timestamp,
    GIT_COMMITTER_DATE: timestamp
  });

  return timestamp;
}

// Commit all dates in dates.json
function commitAll(autoPush = false, force = false) {
  ensureGitConfig();
  const rawList = loadDates();

  if (rawList.length === 0) {
    console.log('[!] dates.json has no dates logged.');
    console.log('    Add dates to dates.json or run:');
    console.log('      node index.js fill 2026       # Generate ~15-20 commits/month across this year');
    console.log('      node index.js add 2026-05-10  # Log and commit a specific date\n');
    return;
  }

  console.log(`\n======================================================`);
  console.log(`Starting backdated commits for ${rawList.length} date entries...`);
  console.log(`Repository: ${REPO_DIR}`);
  console.log(`======================================================\n`);

  let count = 0;
  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    let dateVal = item;
    let repeat = 1;

    if (typeof item === 'object' && item !== null) {
      dateVal = item.date;
      repeat = item.count || item.commits || 1;
    }

    for (let r = 0; r < repeat; r++) {
      count++;
      const ts = makeCommit(dateVal, r);
      if (count % 10 === 0 || count === rawList.length) {
        process.stdout.write(`\r[✓] Progress: ${count}/${rawList.length} commits created (${ts})`);
      }
    }
  }

  console.log(`\n\n[SUCCESS] Created ${count} backdated commits!`);

  if (autoPush) {
    pushCommits(force);
  } else {
    console.log('\n--> To update GitHub and replace the previous commits:');
    console.log('    git push --force origin main');
    console.log('    (or: node index.js push --force)\n');
  }
}

// Add a specific date to dates.json and commit it
function addDate(dateStr, count = 1, autoPush = false, force = false) {
  ensureGitConfig();
  if (!dateStr) {
    console.error('[!] Please provide a date. Example: node index.js add 2026-05-15');
    process.exit(1);
  }

  const dates = loadDates();
  for (let i = 0; i < count; i++) {
    dates.push(dateStr);
  }
  saveDates(dates);

  console.log(`[+] Logged ${count} commit(s) for ${dateStr} into dates.json`);

  for (let i = 0; i < count; i++) {
    const ts = makeCommit(dateStr, i);
    console.log(`[✓] Created commit: ${ts}`);
  }

  if (autoPush) {
    pushCommits(force);
  } else {
    console.log('\n--> Run `node index.js push` or `git push origin main` to sync with GitHub!');
  }
}

// Generate realistic schedule: ~15 to 20 commits per month
function fillYear(targetYear = 2026, minPerMonth = 15, maxPerMonth = 20, autoPush = false, force = false) {
  ensureGitConfig();
  const year = parseInt(targetYear, 10) || new Date().getFullYear();
  const now = new Date();
  const isCurrentYear = (year === now.getFullYear());
  const maxMonth = isCurrentYear ? now.getMonth() : 11;

  console.log(`\n======================================================`);
  console.log(`Generating ~${minPerMonth}-${maxPerMonth} commits/month for year ${year}...`);
  console.log(`======================================================\n`);

  const generatedDates = [];

  for (let month = 0; month <= maxMonth; month++) {
    const daysInMonthTotal = new Date(year, month + 1, 0).getDate();
    const isThisMonth = isCurrentYear && (month === now.getMonth());
    const daysAvailable = isThisMonth ? now.getDate() : daysInMonthTotal;

    // Prorate quota if current month is in progress
    const baseTarget = Math.floor(Math.random() * (maxPerMonth - minPerMonth + 1)) + minPerMonth;
    const targetCommits = isThisMonth
      ? Math.max(1, Math.round(baseTarget * (daysAvailable / daysInMonthTotal)))
      : baseTarget;

    // Pick active days for this month
    const days = Array.from({ length: daysAvailable }, (_, i) => i + 1);
    days.sort(() => Math.random() - 0.5);

    let commitsLeft = targetCommits;
    let dayIdx = 0;
    const monthDates = [];

    while (commitsLeft > 0 && dayIdx < days.length) {
      const day = days[dayIdx++];
      // 1 or 2 commits on active days
      const count = commitsLeft === 1 ? 1 : (Math.random() < 0.65 ? 1 : 2);
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;

      for (let c = 0; c < count && commitsLeft > 0; c++) {
        monthDates.push(dateStr);
        commitsLeft--;
      }
    }

    monthDates.sort();
    generatedDates.push(...monthDates);
  }

  saveDates(generatedDates);
  console.log(`[+] Saved ${generatedDates.length} commit dates into dates.json (~${Math.round(generatedDates.length / (maxMonth + 1))} per month)`);
  console.log(`[i] Now creating commits in Git...\n`);

  let count = 0;
  for (let i = 0; i < generatedDates.length; i++) {
    count++;
    const ts = makeCommit(generatedDates[i], i % 3);
    if (count % 10 === 0 || count === generatedDates.length) {
      process.stdout.write(`\r[✓] Progress: ${count}/${generatedDates.length} commits created (${ts})`);
    }
  }

  console.log(`\n\n[SUCCESS] Created ${count} backdated commits across year ${year}!`);

  if (autoPush) {
    pushCommits(force);
  } else {
    console.log('\n--> To update GitHub and replace the previous high commits:');
    console.log('    git push --force origin main');
    console.log('    (or: node index.js push --force)\n');
  }
}

// Reset commits back to the original base commit before contribution updates
function resetCommits(forcePush = false) {
  ensureGitConfig();
  try {
    const baseCommit = runGit('git log --grep="^Contribution update:" --invert-grep -n 1 --format="%H"');
    if (!baseCommit) {
      console.error('[!] Could not find original base commit.');
      return;
    }

    console.log(`\n[i] Resetting local branch back to base commit: ${baseCommit.slice(0, 7)}`);
    runGit(`git reset ${baseCommit}`);

    // Reset data.json state
    const data = { totalCommits: 0, lastCommit: null, lastUpdated: new Date().toISOString() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    console.log('[✓] Reset local commits successfully!');

    if (forcePush) {
      pushCommits(true);
    } else {
      console.log('\n--> To wipe old commits from GitHub, run:');
      console.log('    git push --force origin main');
      console.log('    (or: node index.js push --force)\n');
    }
  } catch (err) {
    console.error('[!] Reset failed:', err.message);
  }
}

// Push commits to GitHub
function pushCommits(force = false) {
  const forceFlag = force ? ' --force' : '';
  console.log(`\n[i] Pushing commits to GitHub (git push${forceFlag} origin main)...`);
  try {
    const out = runGit(`git push${forceFlag} origin main`);
    console.log(out || '[✓] Pushed successfully!');
    console.log('\n[DONE] Your GitHub contribution graph will update shortly!');
  } catch (err) {
    console.error('[!] Failed to push:', err.message);
    console.log('    Make sure you have write access and are signed in to GitHub.');
    console.log(`    Try pushing manually with: git push${forceFlag} origin main`);
  }
}

// Show repository and commit status
function showStatus() {
  ensureGitConfig();
  const data = loadData();
  const dates = loadDates();

  console.log('\n======================================================');
  console.log('  GitHub Contribution Graph Committer Status');
  console.log('======================================================');
  console.log(`Repository Path : ${REPO_DIR}`);

  try {
    const branch = runGit('git branch --show-current');
    const author = runGit('git config user.name');
    const email = runGit('git config user.email');
    const totalGitCommits = runGit('git rev-list --count HEAD');
    console.log(`Current Branch  : ${branch}`);
    console.log(`Git Author      : ${author} <${email}>`);
    console.log(`Git Total Commits: ${totalGitCommits}`);
  } catch (err) {
    console.log(`Git Status      : ${err.message}`);
  }

  console.log(`Dates in JSON   : ${dates.length}`);
  console.log(`Logged in data  : ${data.totalCommits || 0} commits`);
  console.log(`Last Commit Date: ${data.lastCommit || 'None'}`);
  console.log('======================================================\n');
}

// Print help / usage
function showHelp() {
  console.log(`
GitHub Contribution Graph Committer
===================================
Make your GitHub contribution graph look realistic (~15-20 commits/month).

Commands:
  node index.js                       Commit all dates currently in dates.json
  node index.js commit                Same as above
  node index.js fill [year]           Fill the year with ~15-20 commits per month
  node index.js reset                 Reset local commits back to base commit
  node index.js add <date> [count]    Log a specific date and commit it
  node index.js push [--force]        Push commits to GitHub
  node index.js status                Show repository and commit status
  node index.js help                  Show this help message

Options:
  --force                             Force push to overwrite previous commit history
  --push                              Automatically push to GitHub after committing
`);
}

// CLI entry point
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'commit';
  const autoPush = args.includes('--push');
  const force = args.includes('--force');

  switch (command) {
    case 'commit':
      commitAll(autoPush, force);
      break;

    case 'add':
      const dateStr = args[1];
      const count = parseInt(args[2], 10) || 1;
      addDate(dateStr, count, autoPush, force);
      break;

    case 'fill':
    case 'generate':
      const year = args[1] && !args[1].startsWith('--') ? args[1] : 2026;
      fillYear(year, 15, 20, autoPush, force);
      break;

    case 'reset':
      resetCommits(force || autoPush);
      break;

    case 'push':
      pushCommits(force);
      break;

    case 'status':
      showStatus();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      if (/^\d{4}-\d{2}-\d{2}/.test(command)) {
        const count = parseInt(args[1], 10) || 1;
        addDate(command, count, autoPush, force);
      } else {
        showHelp();
      }
      break;
  }
}

main();
