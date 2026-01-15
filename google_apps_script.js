// ==========================================
// PASTE THIS CODE INTO GOOGLE APPS SCRIPT
// ==========================================
// 1. Create a new Google Sheet
// 2. Extensions > Apps Script
// 3. Paste this code
// 4. Deploy > New Deployment > Web App > Execute as: Me > Who has access: Anyone
//
// FEATURES:
// - Balanced group selection (no group gets ahead of others)
// - Duplicate detection (matricule/email can only register once)
// - Auto Team Assignment (every 3 students in a topic = 1 team)
// - Immutable: Once registered, student cannot re-register

const SHEET_NAME = "Registrations";
const TEAMS_SHEET = "Teams";

const GROUPS = [
    "Group_01_Computer_Vision",
    "Group_02_NLP",
    "Group_03_Time_Series",
    "Group_04_Audio_Processing",
    "Group_05_Agentic_AI",
    "Group_06_MLOps"
];

// Sub-projects per group (3 each)
const SUBPROJECTS = {
    "Group_01_Computer_Vision": ["Student_A_Pothole_Detector", "Student_B_Cocoa_Pod_Counter", "Student_C_Cassava_Disease_Classifier"],
    "Group_02_NLP": ["Student_A_Pidgin_Translator", "Student_B_Yemba_Autocorrect", "Student_C_Dschang_Chatbot"],
    "Group_03_Time_Series": ["Student_A_Market_Forecaster", "Student_B_Electricity_Predictor", "Student_C_Student_Success"],
    "Group_04_Audio_Processing": ["Student_A_Dialect_Keyword_Spotter", "Student_B_Logging_Detector", "Student_C_Cameroonian_ASR"],
    "Group_05_Agentic_AI": ["Student_A_MoMo_Agent", "Student_B_Penal_Code_Assistant", "Student_C_Tour_Guide"],
    "Group_06_MLOps": ["Student_A_Feature_Store", "Student_B_Experiment_Tracker", "Student_C_Data_Validator"]
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Wait 30s for lock (concurrency protection)
    
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({result: "error", message: "No request body received. Confirm the web app URL and method are correct."});
    }

    Logger.log("POST body: " + e.postData.contents);

    const data = JSON.parse(e.postData.contents);
    const selectedTopic = data.selectedTopic;
    const matricule = data.matricule.trim().toUpperCase();
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();
    const githubUsername = data.githubUsername.trim();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // Initialize sheet if needed
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(["Timestamp", "Name", "Matricule", "Email", "GitHub Username", "Topic", "TeamNumber", "SubProject"]);
    }
    
    // ========== VALIDATION ==========
    
    // 1. Check for duplicate Matricule or Email
    const existingData = sheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      const existingMatricule = String(existingData[i][2]).trim().toUpperCase();
      const existingEmail = String(existingData[i][3]).trim().toLowerCase();
      
      if (existingMatricule === matricule) {
        return jsonResponse({result: "error", message: "This Matricule is already registered. You cannot register twice."});
      }
      if (existingEmail === email) {
        return jsonResponse({result: "error", message: "This Email is already registered. You cannot register twice."});
      }
    }
    
    // 2. Check topic availability (balanced selection)
    const availability = calculateAvailability_();
    if (availability[selectedTopic] === false) {
       return jsonResponse({result: "error", message: "This topic is temporarily locked. Please choose another topic to balance the groups."});
    }
    
    // ========== REGISTRATION ==========
    
    // 3. Count how many are already in this topic (to determine team number)
    let topicCount = 0;
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][5] === selectedTopic) {
        topicCount++;
      }
    }
    
    // Team number: 1-based. First 3 students = Team 1, next 3 = Team 2, etc.
    const teamNumber = Math.floor(topicCount / 3) + 1;
    
    // Position within team (0, 1, or 2) determines which sub-project
    const positionInTeam = topicCount % 3;
    const subProject = SUBPROJECTS[selectedTopic][positionInTeam];
    
    // 4. Save to Sheet
    sheet.appendRow([
      new Date(), 
      fullName, 
      matricule, 
      email,
      githubUsername,
      selectedTopic, 
      teamNumber,
      subProject
    ]);
    
    // 5. Update Teams Sheet (optional tracking)
    updateTeamsSheet_(ss, selectedTopic, teamNumber);
    
    return ContentService.createTextOutput(JSON.stringify({
      result: "success", 
      message: "Registered! You are in " + selectedTopic + ", Team " + teamNumber + ", assigned to: " + subProject,
      topic: selectedTopic,
      team: teamNumber,
      project: subProject
    })).setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return jsonResponse({result: "error", message: err.toString()});
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  // Check if student is querying their status
  if (e && e.parameter && e.parameter.action === "checkStatus") {
    return checkStudentStatus_(e.parameter.matricule);
  }
  
  // Default: return availability
  const availability = calculateAvailability_();
  return ContentService.createTextOutput(JSON.stringify(availability))
    .setMimeType(ContentService.MimeType.JSON);
}

// Check if a student is already registered (for the website to show)
function checkStudentStatus_(matricule) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return jsonResponse({registered: false});
  }
  
  const data = sheet.getDataRange().getValues();
  const normalizedMatricule = String(matricule).trim().toUpperCase();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim().toUpperCase() === normalizedMatricule) {
      return jsonResponse({
        registered: true,
        name: data[i][1],
        topic: data[i][5],
        team: data[i][6],
        subProject: data[i][7]
      });
    }
  }
  
  return jsonResponse({registered: false});
}

// Logic: Determine which topics are open based on "Balanced" rule
function calculateAvailability_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) return createAllOpen_();
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return createAllOpen_();
  
  // Count students per group
  const counts = {};
  GROUPS.forEach(g => counts[g] = 0);
  
  for (let i = 1; i < data.length; i++) {
    const topic = data[i][5];
    if (counts[topic] !== undefined) {
      counts[topic]++;
    }
  }
  
  // Find minimum count
  const values = Object.values(counts);
  const minCount = Math.min(...values);
  
  // RULE: A topic is OPEN only if its count equals the minimum
  // This ensures perfectly balanced selection
  const availability = {};
  GROUPS.forEach(g => {
    availability[g] = (counts[g] <= minCount); 
  });
  
  return availability;
}

function createAllOpen_() {
  const a = {};
  GROUPS.forEach(g => a[g] = true);
  return a;
}

// Helper to track teams
function updateTeamsSheet_(ss, topic, teamNumber) {
  let teamsSheet = ss.getSheetByName(TEAMS_SHEET);
  if (!teamsSheet) {
    teamsSheet = ss.insertSheet(TEAMS_SHEET);
    teamsSheet.appendRow(["Topic", "TeamNumber", "MemberCount", "SubProjectsAssigned"]);
  }
  
  // This is a simple log; you can enhance it later
  const data = teamsSheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === topic && data[i][1] === teamNumber) {
      // Update member count
      teamsSheet.getRange(i + 1, 3).setValue(data[i][2] + 1);
      found = true;
      break;
    }
  }
  
  if (!found) {
    teamsSheet.appendRow([topic, teamNumber, 1, SUBPROJECTS[topic].join(", ")]);
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
