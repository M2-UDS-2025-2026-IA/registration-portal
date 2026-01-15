# GitHub Team Auto-Sync Setup Guide

This script automatically creates GitHub teams and invites students based on the Google Sheet registrations.

## Setup Instructions

### 1. Add the Script to Google Apps Script

1. Open your Google Sheet with registrations
2. **Extensions** > **Apps Script**
3. Click **+** (New File) and name it `github_team_sync.gs`
4. Paste the content from `github_team_sync.js`
5. **Save**

### 2. Configure the GitHub Token

1. In Apps Script Editor: **Project Settings** (⚙️ icon on left)
2. Scroll to **Script Properties**
3. Click **Add script property**
4. Add these two properties:
   - **Property:** `GITHUB_TOKEN` | **Value:** `your_token_here`
   - **Property:** `GITHUB_ORG` | **Value:** `M2-UDS-2025-2026-IA`

### 3. Run the Sync

**Option A: From Google Sheets UI**
1. Reload your Google Sheet
2. You'll see a new menu: **GitHub Sync** (next to Help)
3. Click **GitHub Sync** > **Sync Teams to GitHub**
4. Authorize the script when prompted
5. Wait for the "Sync Complete" alert

**Option B: From Apps Script Editor**
1. Select the function: `syncTeamsToGitHub`
2. Click **Run** (▶️)
3. Check the **Execution log** for details

## What It Does

For each team in the Registration sheet:
1. ✅ Creates a GitHub team (e.g., `Team-1-Pothole-Detector`)
2. ✅ Invites the 3 students to the team
3. ✅ Grants the team **push** access to the appropriate repository

## Team Naming Convention

- Format: `Team-{Number}-{ProjectName}`
- Example: `Team-1-Pothole-Detector`

## Troubleshooting

**"GitHub token not found"**
- Make sure you added the `GITHUB_TOKEN` in Script Properties

**"Could not add user X"**
- The GitHub username doesn't exist or is misspelled
- Fix the username in the Sheet and re-run

**"Failed to create team"**
- Check that your token has `admin:org` permissions
- Verify you're an admin of the `M2-UDS-2025-2026-IA` organization

## Re-Running

You can run the script multiple times safely:
- If a team already exists, it updates members
- If a user is already a member, it skips them
- No duplicates are created
