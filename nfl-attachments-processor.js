function processAttachments() {
  const sender = "kcwood@cbs.com";               // TODO: confirm
  const subjectFilter = '"NFL on CBS"';          // Quote exact phrase
  const daysBack = 14;

  const now = new Date();
  const pastDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const afterStr = Utilities.formatDate(pastDate, Session.getScriptTimeZone(), 'yyyy/MM/dd');

  const query = `from:${sender} subject:${subjectFilter} after:${afterStr}`;

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const threads = GmailApp.search(query);

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const attachments = message.getAttachments({includeInlineImages: false, includeAttachments: true});

      attachments.forEach(blob => {
        const name = blob.getName();
        const lname = name.toLowerCase();

        // Accept .map.xls or .map.xlsx (any case)
        const isMapExcel = (lname.endsWith('.map.xls') || lname.endsWith('.map.xlsx'));
        if (!isMapExcel) return;

        // Derive a safe sheet name: strip .xls/.xlsx and sanitize
        const baseName = name.replace(/\.(xls|xlsx)$/i, ''); // drops only the extension
        const safeSheetName = baseName.replace(/[\\\/:*?"<>|]/g, "_").slice(0, 99); // Sheets limit ~100 chars

        // Skip if the tab already exists
        const sheetExists = spreadsheet.getSheets().some(s => s.getName() === safeSheetName);
        if (sheetExists) {
          Logger.log(`Sheet "${safeSheetName}" already exists. Skipping file ${name}.`);
          return;
        }

        let tempFile, convertedFile;
        try {
          // Create temp file in Drive
          tempFile = DriveApp.createFile(blob);
          const fileId = tempFile.getId();

          // Convert to Google Sheets using Advanced Drive Service
          // (Enable: Services → Drive API)
          convertedFile = Drive.Files.copy(
            { title: `${safeSheetName}`, mimeType: MimeType.GOOGLE_SHEETS },
            fileId
          );

          if (!convertedFile || convertedFile.mimeType !== MimeType.GOOGLE_SHEETS) {
            Logger.log(`File ${name} could not be converted to Google Sheets. Skipping.`);
            return;
          }

          const tempSpreadsheet = SpreadsheetApp.openById(convertedFile.id);
          const sourceSheet = tempSpreadsheet.getSheets()[0];
          const lastRow = sourceSheet.getLastRow();
          const lastCol = Math.min(sourceSheet.getLastColumn(), 4);

          if (lastRow === 0 || lastCol < 1) {
            Logger.log(`No data found in ${name}. Skipping.`);
            return;
          }

          const data = sourceSheet.getRange(1, 1, lastRow, lastCol).getValues();

          const newSheet = spreadsheet.insertSheet(safeSheetName);
          spreadsheet.setActiveSheet(newSheet);
          spreadsheet.moveActiveSheet(1); // 1 = first position
          newSheet.getRange(1, 1, data.length, lastCol).setValues(data);

          // Columns E & F VLOOKUPs
          newSheet.getRange("E2").setFormula(`=ARRAYFORMULA(IF(A2:A="","",IFNA(VLOOKUP(TRIM(A2:A),{Stations!A:A,Stations!B:B},2,FALSE),A2:A)))`);
          newSheet.getRange("F2").setFormula(`=ARRAYFORMULA(IF(A2:A="","",IFNA(VLOOKUP(TRIM(A2:A),{Stations!A:A,Stations!E:E},2,FALSE),A2:A)))`);

          // Column G normalized names
          normalizeMatchupsToColumnG(safeSheetName)

          // games and stations extraction
          console.log("creating sheet from KWood, sheet name is ",safeSheetName)
          const gamesAndStations = extractGamesAndItems(safeSheetName)
          // for (let item of gamesAndStations){
          //   console.log(item["fields"]["Game"])
          // } 

          const gameListHtml = gamesAndStations.map(gameObj => {
            const gameName = gameObj.fields.Game?.toString().trim();
            return `<li>${gameName}</li>`;
          }).join("");

          let numberOfGames = gamesAndStations.length
          console.log(numberOfGames)



          const sheetCheck = spreadsheet.getSheetByName("12day to Final Cross Checking")
          if (safeSheetName.includes("12day")){
            sheetCheck.getRange("A1").setValue(safeSheetName);
            sheetCheck.getRange("A10").setValue(safeSheetName);
          }

          if (safeSheetName.includes("FINAL")){
            sheetCheck.getRange("A1").setValue(safeSheetName);
            sheetCheck.getRange("A10").setValue(safeSheetName.replace("FINAL", "12day"));
          }


          const crosschecksheet = spreadsheet.getSheetByName("12day to Final Cross Checking")
          const rangeCheck = crosschecksheet.getRange(1, 1, numberOfGames + 2, 4);
          const finalvalues = rangeCheck.getValues();
          console.log(finalvalues)

          // Build HTML table
          let htmlTable = "<table border='1' cellpadding='5' cellspacing='0' style='border-collapse:collapse'>";
          finalvalues.forEach(row => {
            htmlTable += "<tr>";
            row.forEach(cell => {
              htmlTable += `<td>${cell}</td>`;
            });
            htmlTable += "</tr>";
          });
          htmlTable += "</table>";

          // Send email alert 
          MailApp.sendEmail({
            to: "roberto.fonseca@paramount.com, victor.nolasco@paramount.com, Nurlifitri.Rahman-Bluestone@paramount.com, maxwell.robertson@paramount.com, sara.hakanson@paramount.com, jeffrey.toner@paramount.com, giovanny.infante@paramount.com",            
            //to: "roberto.fonseca@paramount.com, victor.nolasco@paramount.com",
            subject: `${safeSheetName} received from KWood Processing now`,
            htmlBody: `
              <p><strong>NFL Stations Update:</strong></p>
              <p>This is an automated notification that ${safeSheetName} was received from KWood, you can check <a href="https://docs.google.com/spreadsheets/d/1mIAE5QwAmj1ytL8ESVkNsPx2SbRL2k1DBoMAEUsvKb0/edit?gid=2027612988#gid=2027612988">This doc </a> for more details.<\p>
              <p>Here is the list of games found</p>
              <ul>
                ${gameListHtml}
              </ul>

              <p> They are now being transferred to the Airtable bases: <a href="https://airtable.com/appSyUSDFEiCe4Uuc/tbl4iC5D09JfS0t8r/viw3HEQKP5S3gZbya?blocks=hide">P+ Live events </a> and <a href="https://airtable.com/appBxlbm2kzIpeEnb/tblAds2tOMwu6SKpu/viwCa6MGwBRN4sLpo"> CBS Locals </a>. </p
              
              <p>Regards,<br><em>Roberto</em></p>`
          });
          // updates DMA Stations to CBS Locals airtable
          let baseId = 'appBxlbm2kzIpeEnb';
          let tableName = 'tblAds2tOMwu6SKpu';
          let viewName = 'viwCa6MGwBRN4sLpo'; 
          let fieldEventName = 'Event Name';
          let fieldDMAname = 'Stations from Kelly Wood';
          let itemSourceFlag = "F" //use E for DMA id or F for station call sign
          syncGamesToAirtable(safeSheetName,baseId,tableName,viewName,fieldEventName,fieldDMAname,itemSourceFlag);
          
          // updates DMA IDs to P+ Live Events airtable          
          baseId = 'appSyUSDFEiCe4Uuc';
          tableName = 'tbl4iC5D09JfS0t8r';
          viewName = 'viw3HEQKP5S3gZbya'; 
          fieldEventName = 'Match (first team listed is home)';
          fieldDMAname = 'Kelly_DMA_IDs';
          itemSourceFlag = "E" //use E for DMA id or F for station call sign
          syncGamesToAirtable(safeSheetName,baseId,tableName,viewName,fieldEventName,fieldDMAname,itemSourceFlag);
          


          // Aggregations by game in H and K
          // If your Sheets supports LET/LAMBDA, keep as is; otherwise see "No-LAMBDA fallback" below
          newSheet.getRange("H2").setFormula(`=LET(startRow, MATCH("Game", $D:$D, 0) + 1,grng, FILTER($G:$G, ROW($G:$G) >= startRow),drng, FILTER($D:$D, ROW($D:$D) >= startRow),erng, FILTER($E:$E, ROW($E:$E) >= startRow),games, UNIQUE(FILTER(grng, grng<>"")),items, BYROW(games, LAMBDA(r, TEXTJOIN(", ", TRUE, SORT(UNIQUE(FILTER(erng, grng=INDEX(r,1,1), erng<>"")))))),counts, BYROW(games, LAMBDA(r, COUNTA(UNIQUE(FILTER(erng, grng=INDEX(r,1,1), erng<>""))))),HSTACK(games, items, counts))`);

          newSheet.getRange("K2").setFormula(`=LET(startRow, MATCH("Game", $D:$D, 0) + 1,drng, FILTER($D:$D, ROW($D:$D) >= startRow),frng, FILTER($F:$F, ROW($F:$F) >= startRow),grng, FILTER($G:$G, ROW($G:$G) >= startRow),games, UNIQUE(FILTER(grng, grng<>"")),items, BYROW(games, LAMBDA(r, TEXTJOIN(", ", TRUE, SORT(UNIQUE(FILTER(frng, grng=INDEX(r,1,1), frng<>"")))))),counts, BYROW(games, LAMBDA(r, COUNTA(UNIQUE(FILTER(frng, grng=INDEX(r,1,1), frng<>""))))),HSTACK(games, items, counts))`);

          // // Hide row 2 (where arrayformulas spill from)
          // newSheet.hideRows(2);

          // Bold headers
          newSheet.getRange("H1:H1").setValue("Game")
          newSheet.getRange("I1:I1").setValue("P+ Station")
          newSheet.getRange("J1:J1").setValue("Count")
          newSheet.getRange("K1:K1").setValue("Game")
          newSheet.getRange("L1:L1").setValue("DMA IDs")
          newSheet.getRange("M1:M1").setValue("Count")
          newSheet.getRange("H1:M1").setFontWeight("bold");

          // Hide col A:G
          newSheet.hideColumns(1, 7);

          // Column widths (H=8th, K=11th)
          newSheet.setColumnWidth(8, 200);   // H
          newSheet.setColumnWidth(9, 400);  // I
          newSheet.setColumnWidth(11, 200);   // K
          newSheet.setColumnWidth(12, 400);  // L

          // Wrap text in I and L to match your layout comment
          newSheet.getRange("I:I").setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
          newSheet.getRange("L:L").setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

        } catch (e) {
          Logger.log(`Failed to process file ${name}: ${e.message}`);
                    // Clean up temp artifacts if they were created
          try { if (tempFile) DriveApp.getFileById(tempFile.getId()).setTrashed(true); } catch (_) {}
          try { if (convertedFile) DriveApp.getFileById(convertedFile.id).setTrashed(true); } catch (_) {}
        } finally {
          // Clean up temp artifacts if they were created
          try { if (tempFile) DriveApp.getFileById(tempFile.getId()).setTrashed(true); } catch (_) {}
          try { if (convertedFile) DriveApp.getFileById(convertedFile.id).setTrashed(true); } catch (_) {}
        }
      });
    });
  });
}




function normalizeMatchupsToColumnG(newSheet) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(newSheet);
  const lastRow = sheet.getLastRow();
  const inputRange = sheet.getRange("D2:D" + lastRow);
  const inputValues = inputRange.getValues();

  const teamMap = {
    "ARI": "Arizona", "ARZ": "Arizona", "ATL": "Atlanta", "BAL": "Baltimore", "BUF": "Buffalo",
    "CAR": "Carolina", "CHI": "Chicago", "CIN": "Cincinnati", "CLE": "Cleveland",
    "DAL": "Dallas", "DEN": "Denver", "DET": "Detroit", "GB": "Green Bay",
    "HOU": "Houston", "IND": "Indianapolis", "JAX": "Jacksonville", "KC": "Kansas City",
    "LV": "Las Vegas", "LAC": "L.A. Chargers", "LAR": "L.A. Rams", "MIA": "Miami",
    "MIN": "Minnesota", "NE": "New England", "NO": "New Orleans",
    "NYG": "N.Y. Giants", "NYJ": "N.Y. Jets", "PHI": "Philadelphia",
    "PIT": "Pittsburgh", "SEA": "Seattle", "SF": "San Francisco",
    "TB": "Tampa Bay", "TEN": "Tennessee", "WAS": "Washington",

    // Full names
    "Buffalo": "Buffalo", "NY Jets": "N.Y. Jets", "NY Giants": "N.Y. Giants",
    "New England": "New England", "Miami": "Miami", "LA Rams": "L.A. Rams",
    "LA Chargers": "L.A. Chargers", "Tennessee": "Tennessee", "Cleveland": "Cleveland",
    "Baltimore": "Baltimore", "Seattle": "Seattle", "New Orleans": "New Orleans",
    "Denver": "Denver", "Indianapolis": "Indianapolis"
  };

  const outputValues = inputValues.map(row => {
    const cell = row[0];
    if (typeof cell === "string" && cell.includes("@")) {
      try {
        // Remove any prefix (e.g., time) and suffix (e.g., - Constant)
        // const matchupPart = cell.split("-")[0].trim(); // e.g., "BUF @ NYJ"
        // const parts = matchupPart.split(" @ ");
        parts = extractMatchup(cell)
        if (parts.length !== 2) throw new Error("Invalid format");

        const awayRaw = parts[0].trim();
        const homeRaw = parts[1].trim();
        const away = teamMap[awayRaw] || awayRaw;
        const home = teamMap[homeRaw] || homeRaw;

        return [`${away} at ${home}`];
      } catch (e) {
        return ["Invalid matchup"];
      }
    }
    return [""];
  });

  const outputRange = sheet.getRange(2, 7, outputValues.length, 1); // Column G = 7
  outputRange.setValues(outputValues);
}

function extractMatchup(cell) {
    // Find the position of '@'
    const atIndex = cell.indexOf('@');
    if (atIndex === -1) throw new Error("Invalid format: missing '@'");

    // Remove any prefix before '-' if '-' is before '@'
    let startIndex = 0;
    const dashBeforeAt = cell.lastIndexOf('-', atIndex);
    if (dashBeforeAt !== -1) {
        startIndex = dashBeforeAt + 1;
    }

    // Remove any suffix after '-' if '-' is after '@'
    let endIndex = cell.length;
    const dashAfterAt = cell.indexOf('-', atIndex);
    if (dashAfterAt !== -1) {
        endIndex = dashAfterAt;
    }

    const matchupPart = cell.slice(startIndex, endIndex).trim(); // e.g., "BUF @ NYJ"
    //const parts = matchupPart.split(" @ ");
    const parts = matchupPart.split(/\s*@\s*/);  // 👈 flexible spaces around '@'
    if (parts.length !== 2) throw new Error("Invalid format: expected 'TEAM @ TEAM'");

    return parts;
}


function extractGamesAndItems(YourSheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(YourSheetName);

  const columnE = sheet.getRange("E:E").getValues().flat();
  const columnG = sheet.getRange("G:G").getValues().flat();

  // Find the row after "Game"
  const startRow = columnE.findIndex(val => val === "Game") + 1;

  // Slice the data from that point onward
  const filteredE = columnE.slice(startRow);
  const filteredG = columnG.slice(startRow);

  // Build a map of game => items
  const gameMap = {};

  for (let i = 0; i < filteredG.length; i++) {
    const game = filteredG[i];
    const item = filteredE[i];

    if (game && item) {
      if (!gameMap[game]) {
        gameMap[game] = new Set();
      }
      gameMap[game].add(item);
    }
  }

  // Convert to array format for Airtable
  const data = Object.entries(gameMap).map(([game, itemsSet]) => ({
    fields: {
      Game: game,
      Items: Array.from(itemsSet)
    }
  }));

  return data;
}

/////////////////////////////

function syncGamesToAirtable(YourSheetName,baseId,tableName,viewName,fieldEventName,fieldDMAname,itemSourceFlag) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(YourSheetName);
  const columnE = sheet.getRange("E:E").getValues().flat();
  const columnF = sheet.getRange("F:F").getValues().flat();
  const columnG = sheet.getRange("G:G").getValues().flat();

  // const columnD = sheet.getRange("D:D").getValues().flat();
  // const startRow = columnD.findIndex(val => val === "Game") + 1;
    // Find the row after "Game"
  const startRow = columnE.findIndex(val => val === "Game") + 1;
  
  const filteredE = columnE.slice(startRow).map(String);
  const filteredF = columnF.slice(startRow).map(String);
  const filteredG = columnG.slice(startRow);

  const gameMap = {};
  for (let i = 0; i < filteredG.length; i++) {
    const game = filteredG[i];
    const item = itemSourceFlag === "E" ? filteredF[i] : filteredE[i];//filteredE[i];
    if (game && item) {
      if (!gameMap[game]) gameMap[game] = new Set();
      gameMap[game].add(item);
    }
  }

  // Store the Airtable PAT in Script Properties (Project Settings → Script Properties),
  // never hardcode it in source.
  const airtableApiKey = PropertiesService.getScriptProperties().getProperty('AIRTABLE_API_KEY');
  const airtableEndpoint = `https://api.airtable.com/v0/${baseId}/${tableName}`;

  const headers = {
    Authorization: `Bearer ${airtableApiKey}`
  };

  Object.entries(gameMap).forEach(([game, itemsSet]) => {
    const trimmedGame = game.trim();
    //const formula = `TRIM({${fieldEventName}})="${trimmedGame}"`;
    const queryUrl = `${airtableEndpoint}?view=${encodeURIComponent(viewName)}&filterByFormula=${encodeURIComponent(`TRIM({${fieldEventName}})="${game}"`)}`;

    try {
      const response = UrlFetchApp.fetch(queryUrl, { headers });
      const result = JSON.parse(response.getContentText());


      if (result.records.length > 0) {
        const recordId = result.records[0].id;
        //console.log(recordId,game)

        const updatePayload = {
          fields: {
            [fieldDMAname]: Array.from(itemsSet).sort() // Linked field expects array of strings
          },
          typecast: true // Auto-create missing select options instead of erroring (INVALID_MULTIPLE_CHOICE_OPTIONS)
        };
        //console.log(updatePayload)

        const updateOptions = {
          method: 'patch',
          contentType: 'application/json',
          headers,
          payload: JSON.stringify(updatePayload)
        };
        console.log(`${airtableEndpoint}/${recordId}`)

        UrlFetchApp.fetch(`${airtableEndpoint}/${recordId}`, updateOptions);
      } else {
        // Send email alert if game not found
        MailApp.sendEmail({
          to: "roberto.fonseca@paramount.com",
          subject: `${game} not found`,
          body: `The game "${game}" was not found in the Airtable view "${viewName}".`
        });
      }
    } catch (error) {
      Logger.log(`Error processing game "${game}": ${error}`);
        // Send email alert if game not found
      MailApp.sendEmail({
        to: "roberto.fonseca@paramount.com",
        subject: `Error processing game "${game}"`,
        body: `Error processing game "${game}": ${error}`
    })
    }
  });
}
