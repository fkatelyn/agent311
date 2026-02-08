# Git and GitHub CLI Guide

A practical guide for using `git` and `gh` CLI for everyday development tasks.

## Prerequisites

### 1. Git Configuration

Set your identity (required for commits):

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Verify your config:
```bash
git config --list
```

### 2. SSH Keys for GitHub

GitHub requires SSH keys for authentication when pushing/pulling.

**Check if you have SSH keys:**
```bash
ls -la ~/.ssh
# Look for id_rsa.pub, id_ed25519.pub, or similar
```

**Generate a new SSH key (if needed):**
```bash
ssh-keygen -t ed25519 -C "your.email@example.com"
# Press Enter to accept default location
# Enter a passphrase (optional but recommended)
```

**Add SSH key to ssh-agent:**
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

**Add SSH key to GitHub:**
```bash
# Copy your public key
cat ~/.ssh/id_ed25519.pub
# Or use: pbcopy < ~/.ssh/id_ed25519.pub (macOS)

# Then go to GitHub.com:
# Settings → SSH and GPG keys → New SSH key
# Paste your public key
```

**Test your connection:**
```bash
ssh -T git@github.com
# Should see: "Hi username! You've successfully authenticated..."
```

### 3. GitHub CLI (gh)

**Install gh:**
```bash
# macOS
brew install gh

# Linux
sudo apt install gh  # Debian/Ubuntu
```

**Authenticate gh:**
```bash
gh auth login
# Follow prompts:
# - Choose GitHub.com
# - Choose SSH
# - Choose your existing SSH key
# - Authenticate in browser
```

**Verify:**
```bash
gh auth status
```

## Common Workflows

### Basic Commit and Push

```bash
# Check status
git status

# Stage files
git add file1.py file2.js
# Or stage all changes:
git add .

# Commit with message
git commit -m "Add feature X"

# Push to current branch
git push

# First push on new branch (sets upstream):
git push -u origin branch-name
```

### Create a New Branch

```bash
# Create and switch to new branch
git checkout -b feature/new-feature

# Or using modern syntax:
git switch -c feature/new-feature

# Push new branch to remote
git push -u origin feature/new-feature
```

### Switch Between Branches

```bash
# Switch to existing branch
git checkout main
# Or:
git switch main

# List all branches
git branch -a
```

### Merge Branch to Main

**Option 1: Direct merge (local)**
```bash
# Switch to main
git checkout main

# Pull latest changes
git pull

# Merge your branch
git merge feature/new-feature

# Push to remote
git push
```

**Option 2: Via Pull Request (recommended)**
```bash
# Push your branch
git push -u origin feature/new-feature

# Create PR using gh
gh pr create --title "Add new feature" --body "Description of changes"

# Or interactive mode:
gh pr create

# Merge PR from command line
gh pr merge 123 --squash
# Or: --merge, --rebase
```

### Create a Pull Request

```bash
# Make sure your branch is pushed
git push -u origin feature/new-feature

# Create PR
gh pr create \
  --title "Add authentication" \
  --body "Implements user login and session management"

# Create PR with more options
gh pr create \
  --title "Fix bug in API" \
  --body "Fixes the timeout issue" \
  --base main \
  --head feature-branch \
  --assignee @me \
  --label bug

# Create draft PR
gh pr create --draft

# Interactive mode (prompts for title, body, etc.)
gh pr create
```

### Useful gh Commands

**View PRs:**
```bash
# List open PRs
gh pr list

# List all PRs (open, closed, merged)
gh pr list --state all

# View specific PR
gh pr view 123

# View PR in browser
gh pr view 123 --web
```

**Manage PRs:**
```bash
# Checkout a PR locally
gh pr checkout 123

# Review a PR
gh pr review 123 --approve
gh pr review 123 --comment --body "Looks good!"
gh pr review 123 --request-changes --body "Needs tests"

# Merge a PR
gh pr merge 123 --squash
gh pr merge 123 --merge
gh pr merge 123 --rebase

# Close a PR
gh pr close 123
```

**Repository operations:**
```bash
# Clone a repo
gh repo clone username/repo-name

# View repo in browser
gh repo view --web

# Create new repo
gh repo create my-new-repo --public

# Fork a repo
gh repo fork owner/repo-name
```

**Issues:**
```bash
# List issues
gh issue list

# Create issue
gh issue create --title "Bug report" --body "Description"

# View issue
gh issue view 456

# Close issue
gh issue close 456
```

## Quick Reference

### Git Basics
```bash
git status              # Show working tree status
git add <file>          # Stage file
git add .               # Stage all changes
git commit -m "msg"     # Commit with message
git push                # Push to remote
git pull                # Pull from remote
git log                 # View commit history
git diff                # Show unstaged changes
```

### Branching
```bash
git branch              # List branches
git checkout -b <name>  # Create and switch to branch
git switch <name>       # Switch to branch
git merge <branch>      # Merge branch into current
git branch -d <name>    # Delete local branch
git push -d origin <n>  # Delete remote branch
```

### gh PR Workflow
```bash
git checkout -b feat    # Create feature branch
# ... make changes ...
git add .
git commit -m "Add X"
git push -u origin feat
gh pr create            # Create PR
gh pr merge --squash    # Merge when ready
```

## Tips

- **Commit often**: Small, focused commits are easier to review and revert
- **Pull before push**: Always `git pull` before pushing to avoid conflicts
- **Use branches**: Never work directly on `main` for features
- **Write clear messages**: Commit messages should explain *what* and *why*
- **Check before commit**: Use `git status` and `git diff` to review changes

## Troubleshooting

**"Permission denied (publickey)"**
- Your SSH key isn't configured correctly
- Run `ssh -T git@github.com` to test
- Re-add key: `ssh-add ~/.ssh/id_ed25519`

**"fatal: not a git repository"**
- You're not in a git repository
- Run `git init` or `cd` into your project

**Merge conflicts**
```bash
# When you see conflicts:
git status              # See which files have conflicts
# Edit files to resolve conflicts (look for <<<<<<< markers)
git add <resolved-file>
git commit              # Complete the merge
```

**Undo last commit (not pushed)**
```bash
git reset --soft HEAD~1  # Keep changes staged
git reset HEAD~1         # Keep changes unstaged
git reset --hard HEAD~1  # Discard changes (careful!)
```

**Undo pushed commit**
```bash
git revert HEAD          # Create new commit that undoes last commit
git push
```
