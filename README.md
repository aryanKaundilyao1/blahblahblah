# blahblahblah!
heuheuh

## GitHub Contribution Graph Committer 🟩

Custom backdated commit generator and date logger to light up your GitHub contribution graph.

### 📁 Files
- `dates.json`: Log individual dates or commit schedules.
- `data.json`: Tracks activity metadata and commit counters for Git.
- `index.js`: Zero-dependency Node.js script that creates backdated commits with matching author dates.

---

### 🚀 Usage

#### 1. Commit All Dates from `dates.json`
```bash
node index.js
# or
npm run commit
```

#### 2. Log & Commit a Specific Date
```bash
node index.js add 2026-05-15       # 1 commit
node index.js add 2026-05-15 3     # 3 commits (darker green square)
```

#### 3. Automatically Fill the Year 2026
Generates realistic commits (1-4 commits/day across ~75% of days) across the year:
```bash
node index.js fill 2026
# or
npm run fill
```

#### 4. Push to GitHub
```bash
git push origin main
# or
node index.js push
```
*(You can also append `--push` to any command to push immediately, e.g. `node index.js fill 2026 --push`)*

---

### ⚠️ Requirements for GitHub Graph to Turn Green:
1. **Email Match**: Your Git commit author email must match your verified GitHub email address (`aryankaundilya.jas@gmail.com`).
2. **Default Branch**: Commits must be on the repository's default branch (`main`).
3. **Pushed to GitHub**: Commits must be pushed to remote GitHub repository.
4. **Private Repo Setting**: If your repository is private, enable **"Private contributions"** in your GitHub profile settings.
