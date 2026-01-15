// ==========================================
// GITHUB TEAM AUTO-ASSIGNMENT SCRIPT
// ==========================================
// Add this to your Google Apps Script project alongside the registration script
// 
// SETUP:
// 1. In Apps Script Editor: Project Settings > Script Properties
// 2. Add property: GITHUB_TOKEN = your_token_here
// 3. Add property: GITHUB_ORG = M2-UDS-2025-2026-IA
//
// USAGE:
// Run the function: syncTeamsToGitHub()
// This will create teams and invite students based on the Registration sheet

const ORG_NAME = "M2-UDS-2025-2026-IA";

// Mapping of Group to Repository name
const GROUP_TO_REPO = {
    "Group_01_Computer_Vision": "M2-IA-Group_01_Computer_Vision",
    "Group_02_NLP": "M2-IA-Group_02_NLP",
    "Group_03_Time_Series": "M2-IA-Group_03_Time_Series",
    "Group_04_Audio_Processing": "M2-IA-Group_04_Audio_Processing",
    "Group_05_Agentic_AI": "M2-IA-Group_05_Agentic_AI",
    "Group_06_MLOps": "M2-IA-Group_06_MLOps"
};

// Main function to sync all teams
function syncTeamsToGitHub() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  
  if (!token) {
    throw new Error("GitHub token not found. Set it in Project Settings > Script Properties.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Registrations");
  
  if (!sheet) {
    throw new Error("Registrations sheet not found.");
  }
  
  // Read all registrations
  const data = sheet.getDataRange().getValues();
  
  // Skip header row
  const registrations = [];
  for (let i = 1; i < data.length; i++) {
    registrations.push({
      name: data[i][1],
      matricule: data[i][2],
      email: data[i][3],
      githubUsername: data[i][4],
      topic: data[i][5],
      teamNumber: data[i][6],
      subProject: data[i][7]
    });
  }
  
  // Group by Team
  const teams = groupByTeam(registrations);
  
  Logger.log(`Found ${Object.keys(teams).length} teams to process.`);
  
  // Create teams and invite members
  let successCount = 0;
  let errorCount = 0;
  
  for (const teamKey in teams) {
    try {
      const teamData = teams[teamKey];
      createOrUpdateTeam(token, teamKey, teamData);
      successCount++;
      Logger.log(`✓ Processed team: ${teamKey}`);
    } catch (e) {
      errorCount++;
      Logger.log(`✗ Error processing ${teamKey}: ${e.toString()}`);
    }
  }
  
  Logger.log(`\nSummary: ${successCount} teams processed, ${errorCount} errors.`);
  
  // Show result to user
  SpreadsheetApp.getUi().alert(
    `GitHub Sync Complete\n\n` +
    `✓ Teams processed: ${successCount}\n` +
    `✗ Errors: ${errorCount}\n\n` +
    `Check the Execution Log (View > Logs) for details.`
  );
}

// Group registrations by team
function groupByTeam(registrations) {
  const teams = {};
  
  registrations.forEach(reg => {
    const teamKey = `${reg.topic}-Team${reg.teamNumber}`;
    
    if (!teams[teamKey]) {
      teams[teamKey] = {
        topic: reg.topic,
        teamNumber: reg.teamNumber,
        subProject: reg.subProject,
        members: []
      };
    }
    
    teams[teamKey].members.push({
      name: reg.name,
      githubUsername: reg.githubUsername,
      email: reg.email
    });
  });
  
  return teams;
}

// Create or update a GitHub team
function createOrUpdateTeam(token, teamKey, teamData) {
  const teamName = `Team-${teamData.teamNumber}-${teamData.subProject.replace('Student_', '').replace(/_/g, '-')}`;
  const repo = GROUP_TO_REPO[teamData.topic];
  
  // 1. Create team (or get existing)
  const teamSlug = createTeam(token, teamName, `Students working on ${teamData.subProject}`);
  
  // 2. Add members
  teamData.members.forEach(member => {
    addTeamMember(token, teamSlug, member.githubUsername);
  });
  
  // 3. Grant team access to repository
  grantTeamRepoAccess(token, teamSlug, repo);
  
  Logger.log(`  → Team: ${teamName}, Members: ${teamData.members.length}, Repo: ${repo}`);
}

// GitHub API: Create team
function createTeam(token, teamName, description) {
  const url = `https://api.github.com/orgs/${ORG_NAME}/teams`;
  
  const payload = {
    name: teamName,
    description: description,
    privacy: "closed" // Only visible to org members
  };
  
  const options = {
    method: "post",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json"
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode === 201) {
    // Team created successfully
    const result = JSON.parse(response.getContentText());
    return result.slug;
  } else if (responseCode === 422) {
    // Team already exists, fetch it
    return getTeamSlug(token, teamName);
  } else {
    throw new Error(`Failed to create team ${teamName}: ${response.getContentText()}`);
  }
}

// Get team slug if team already exists
function getTeamSlug(token, teamName) {
  const url = `https://api.github.com/orgs/${ORG_NAME}/teams`;
  
  const options = {
    method: "get",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json"
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const teams = JSON.parse(response.getContentText());
  
  const team = teams.find(t => t.name === teamName);
  if (team) {
    return team.slug;
  } else {
    throw new Error(`Team ${teamName} not found.`);
  }
}

// GitHub API: Add member to team
function addTeamMember(token, teamSlug, username) {
  const url = `https://api.github.com/orgs/${ORG_NAME}/teams/${teamSlug}/memberships/${username}`;
  
  const payload = {
    role: "member"
  };
  
  const options = {
    method: "put",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json"
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 200 && responseCode !== 201) {
    Logger.log(`  ⚠ Warning: Could not add ${username} (may not exist or already invited)`);
  }
}

// GitHub API: Grant team access to repository
function grantTeamRepoAccess(token, teamSlug, repoName) {
  const url = `https://api.github.com/orgs/${ORG_NAME}/teams/${teamSlug}/repos/${ORG_NAME}/${repoName}`;
  
  const payload = {
    permission: "push" // Members can push code
  };
  
  const options = {
    method: "put",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json"
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 204) {
    throw new Error(`Failed to grant access to ${repoName}: ${response.getContentText()}`);
  }
}

// Helper: Add menu to Google Sheets UI
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('GitHub Sync')
    .addItem('Sync Teams to GitHub', 'syncTeamsToGitHub')
    .addToUi();
}
