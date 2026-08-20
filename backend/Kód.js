// --- 1. DISPEČER PRO EXTERNÍ APLIKACI (GITHUB / FETCH) ---
function doPost(e) {
  let request;
  try {
    request = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: "Neplatná data ze serveru."}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  let response = {};
  try {
    if (request.action === "authenticateMember") response = authenticateMember(request.payload);
    else if (request.action === "getInitialData") response = getInitialData();
    else if (request.action === "saveUcast") response = saveUcast(request.payload);
    else if (request.action === "saveAkce") response = saveAkce(request.payload);
    else if (request.action === "deleteAkce") response = deleteAkce(request.payload);
  } catch (error) {
    response = { success: false, error: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// Pro povolení CORS (nutné pro volání z vnějšího webu)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

// --- 2. FUNKCE PRO PŘIHLAŠOVÁNÍ (S KONTROLOU PINU) ---
function authenticateMember(payload) {
  const query = String(payload.query || "").trim().toLowerCase();
  const providedPin = String(payload.pin || "").trim(); // Přijatý PIN z aplikace

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Seznam členů");
  if (!sheet) return { success: false, error: "List 'Seznam členů' nenalezen" };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const jmeno = String(row[1] || "").trim();
    const prijmeni = String(row[2] || "").trim();
    const nastroj = String(row[4] || "").trim() || String(row[3] || "").trim();
    const email = String(row[5] || "").trim().toLowerCase(); 
    const role = String(row[6] || "").trim(); 
    const aktivni = String(row[8] || "").trim().toLowerCase(); 
    
    // Načtení PINu ze sloupce J (Index 9)
    const spravnyPin = String(row[9] || "").trim(); 

    const celeJmeno = jmeno + " " + prijmeni;
    
    if (aktivni === "ano" || aktivni === "true" || aktivni === "1") {
      // Nejprve zkontrolujeme, zda sedí jméno nebo e-mail
      if (celeJmeno.toLowerCase().includes(query) || (email && email === query)) {
        
        // Pokud ano, zkontrolujeme PIN
        if (providedPin === spravnyPin && spravnyPin !== "") {
          return {
            success: true,
            member: { name: celeJmeno, section: nastroj, role: role }
          };
        } else {
          // Jméno sedí, ale PIN je špatný
          return { success: false, error: "Nesprávný PIN kód." };
        }
      }
    }
  }
  return { success: false, error: "Člen nenalezen nebo chybný PIN." };
}

// --- 3. NAČTENÍ DAT (AKCE, NOTY, ÚČAST) ---
function getInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Akce
  let akce = [];
  const sheetAkce = ss.getSheetByName("Přehled akcí");
  if (sheetAkce) {
    const dataAkce = sheetAkce.getDataRange().getValues();
    for (let i = 1; i < dataAkce.length; i++) {
      const row = dataAkce[i];
      if (row[0]) {
        let datumVal = row[4];
        if (datumVal instanceof Date) datumVal = Utilities.formatDate(datumVal, "Europe/Prague", "d. M. yyyy");
        akce.push({
          id: String(row[0]),
          typ: row[1],
          nazev: row[2],
          misto: row[3],
          datum: datumVal,
          casOd: row[5] instanceof Date ? Utilities.formatDate(row[5], "Europe/Prague", "HH:mm") : row[5],
          casDo: row[6],
          casSrazu: row[7] instanceof Date ? Utilities.formatDate(row[7], "Europe/Prague", "HH:mm") : row[7],
          zacatekGeneralky: row[8] instanceof Date ? Utilities.formatDate(row[8], "Europe/Prague", "HH:mm") : row[8],
          uzavierka: row[9] instanceof Date ? Utilities.formatDate(row[9], "Europe/Prague", "d. M. yyyy") : row[9],
          damy: row[10],
          pani: row[11],
          poznamka: row[12]
        });
      }
    }
  }

  // Noty
  let noty = [];
  const sheetNoty = ss.getSheetByName("Notový archiv");
  if (sheetNoty) {
    const dataNoty = sheetNoty.getDataRange().getValues();
    for (let i = 1; i < dataNoty.length; i++) {
      if (dataNoty[i][0]) noty.push({ nazev: dataNoty[i][0], skladatel: dataNoty[i][1], link: dataNoty[i][2] });
    }
  }

  // Účast
  let ucast = [];
  const sheetUcast = ss.getSheetByName("Docházka a účast");
  if (sheetUcast) {
    const dataUcast = sheetUcast.getDataRange().getValues();
    for (let i = 1; i < dataUcast.length; i++) {
      if (dataUcast[i][1]) ucast.push({ akceId: String(dataUcast[i][1]), jmeno: dataUcast[i][3], sekce: dataUcast[i][4], stav: dataUcast[i][5], duvod: dataUcast[i][6] });
    }
  }

  return { akce: akce, noty: noty, ucast: ucast };
}

// --- 4. ULOŽENÍ HLASOVÁNÍ ---
function saveUcast(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Docházka a účast");
  if (!sheet) return { success: false, error: "List 'Docházka a účast' nenalezen" };

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(payload.akceId) && String(data[i][3]) === String(payload.jmeno)) {
      rowIndex = i + 1;
      break;
    }
  }

  const timestamp = Utilities.formatDate(new Date(), "Europe/Prague", "d. M. yyyy HH:mm:ss");

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1).setValue(timestamp);
    sheet.getRange(rowIndex, 6).setValue(payload.stav);
    sheet.getRange(rowIndex, 7).setValue(payload.duvod || "");
  } else {
    sheet.appendRow([timestamp, payload.akceId, payload.datumAkce || "", payload.jmeno, payload.sekce, payload.stav, payload.duvod || ""]);
  }

  try { aktualizovatPrehledUčasti(); } catch (e) {}
  return { success: true };
}

// --- 5. TVORBA / ÚPRAVA AKCÍ (PRO VEDENÍ) ---
function saveAkce(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Přehled akcí");
  if (!sheet) return { success: false, error: "List 'Přehled akcí' nenalezen." };

  const data = sheet.getDataRange().getValues();
  let akceId = payload.id ? String(payload.id).trim() : "";
  let rowIndex = -1;

  if (akceId) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === akceId) { rowIndex = i + 1; break; }
    }
  }

  if (rowIndex === -1) {
    const typ = String(payload.typ || "").toLowerCase();
    let prefix = "akce_";
    if (typ.includes("koncert")) prefix = "k_";
    else if (typ.includes("zkoušk") || typ.includes("zkouska")) prefix = "zk_";
    else if (typ.includes("generálk") || typ.includes("generalka")) prefix = "gen_";

    let maxNum = 0;
    for (let i = 1; i < data.length; i++) {
      let existingId = String(data[i][0]).trim();
      if (existingId.startsWith(prefix)) {
        let numPart = parseInt(existingId.replace(prefix, ""), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    }
    akceId = prefix + String(maxNum + 1).padStart(3, '0');
  }

  // Zápis sloupců A až M
  const rowValues = [
    akceId, payload.typ || "", payload.nazev || "", payload.misto || "", payload.datum || "",
    payload.casOd || "", "", payload.casSrazu || "", payload.zacatekGeneralky || "",
    "", payload.damy || "", payload.pani || "", payload.poznamka || ""
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  try { aktualizovatPrehledUčasti(); } catch (e) {}
  return { success: true, id: akceId };
}

// --- 6. SMAZÁNÍ AKCE (PRO VEDENÍ) ---
function deleteAkce(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Přehled akcí");
  if (!sheet) return { success: false, error: "List 'Přehled akcí' nenalezen." };
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.id).trim()) {
      sheet.deleteRow(i + 1);
      try { aktualizovatPrehledUčasti(); } catch (e) {}
      return { success: true };
    }
  }
  return { success: false, error: "Akce nebyla nalezena." };
}

// --- 7. GENERÁTOR PŘEHLEDU ÚČASTI (MATICE) ---
function aktualizovatPrehledUčasti() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const partituraSections = [
    "1. Housle", "2. Housle", "Violy", "Violoncella", "Kontrabasy", "Flétny / Pikola", "Oboje / Anglický roh",
    "Klarinety", "Fagoty", "Lesní rohy", "Trubky", "Pozouny", "Tuba", "Bicí nástroje", "Klávesy / Klavír", "Ostatní / Hosté"
  ];

  const sheetClenove = ss.getSheetByName("Seznam členů");
  if (!sheetClenove) return;
  const dataClenove = sheetClenove.getDataRange().getValues();
  
  let members = [];
  for (let i = 1; i < dataClenove.length; i++) {
    const row = dataClenove[i];
    const jmeno = String(row[1] || "").trim();
    const prijmeni = String(row[2] || "").trim();
    const nástroj = String(row[4] || "").trim() || String(row[3] || "").trim();
    const aktivni = String(row[8] || "").trim().toLowerCase();

    if ((aktivni === "ano" || aktivni === "true" || aktivni === "1") && jmeno) {
      let secIndex = partituraSections.findIndex(s => s.toLowerCase() === nástroj.toLowerCase());
      if (secIndex === -1) {
        let insL = nástroj.toLowerCase();
        if (insL.includes("housle") && insL.includes("1")) secIndex = 0;
        else if (insL.includes("housle") && insL.includes("2")) secIndex = 1;
        else if (insL.includes("housle")) secIndex = 0;
        else if (insL.includes("viola")) secIndex = 2;
        else if (insL.includes("cello") || insL.includes("kontrabas")) secIndex = 4; 
        else if (insL.includes("flétn") || insL.includes("pikol")) secIndex = 5;
        else if (insL.includes("oboj")) secIndex = 6;
        else if (insL.includes("klarinet")) secIndex = 7;
        else if (insL.includes("fagot")) secIndex = 8;
        else if (insL.includes("roh")) secIndex = 9;
        else if (insL.includes("trubk")) secIndex = 10;
        else if (insL.includes("pozoun")) secIndex = 11;
        else if (insL.includes("tuba")) secIndex = 12;
        else if (insL.includes("bicí")) secIndex = 13;
        else if (insL.includes("klavír")) secIndex = 14;
        else secIndex = 15;
      }
      members.push({ celéJméno: jmeno + " " + prijmeni, příjmení: prijmeni, nástroj: nástroj || "Ostatní / Hosté", secIndex: secIndex });
    }
  }

  members.sort((a, b) => {
    if (a.secIndex !== b.secIndex) return a.secIndex - b.secIndex;
    return a.příjmení.localeCompare(b.příjmení, 'cs');
  });

  const sheetAkce = ss.getSheetByName("Přehled akcí");
  if (!sheetAkce) return;
  const dataAkce = sheetAkce.getDataRange().getValues();
  let akceList = [];
  for (let i = 1; i < dataAkce.length; i++) {
    const row = dataAkce[i];
    if (row[0] && row[4]) {
      akceList.push({
        id: String(row[0]), typ: row[1], nazev: row[2],
        datumStr: row[4] instanceof Date ? Utilities.formatDate(row[4], "Europe/Prague", "d. M. yyyy") : String(row[4]),
        dateObj: row[4] instanceof Date ? row[4] : new Date(row[4])
      });
    }
  }
  akceList.sort((a, b) => a.dateObj - b.dateObj);

  const sheetUcast = ss.getSheetByName("Docházka a účast");
  const dataUcast = sheetUcast ? sheetUcast.getDataRange().getValues() : [];
  let ucastMap = {};
  for (let i = 1; i < dataUcast.length; i++) {
    if (dataUcast[i][1] && dataUcast[i][3]) ucastMap[String(dataUcast[i][3]).trim() + "_" + String(dataUcast[i][1])] = String(dataUcast[i][5]).trim();
  }

  let sheetPrehled = ss.getSheetByName("Přehled účasti");
  if (!sheetPrehled) sheetPrehled = ss.insertSheet("Přehled účasti");
  else sheetPrehled.clear();

  let header = ["Jméno hráče", "Nástroj"];
  akceList.forEach(a => header.push(a.typ + ": " + a.nazev + " (" + a.datumStr + ")"));
  
  let tableData = [header];
  members.forEach(m => {
    let row = [m.celéJméno, m.nástroj];
    akceList.forEach(a => {
      let stav = ucastMap[m.celéJméno + "_" + a.id] || "";
      row.push(stav === "Ano" ? "✓" : (stav === "Ne" ? "✕" : ""));
    });
    tableData.push(row);
  });

  let sumRow = ["Celkem zúčastněných", ""];
  for (let colIdx = 2; colIdx < header.length; colIdx++) {
    let count = 0;
    for (let rowIdx = 1; rowIdx < tableData.length; rowIdx++) {
      if (tableData[rowIdx][colIdx] === "✓") count++;
    }
    sumRow.push(count);
  }
  tableData.push(sumRow);

  sheetPrehled.getRange(1, 1, tableData.length, header.length).setValues(tableData);
  sheetPrehled.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#221d44").setFontColor("#ffffff");
  sheetPrehled.getRange(tableData.length, 1, 1, header.length).setFontWeight("bold").setBackground("#f0f2f5");
  sheetPrehled.setFrozenRows(1);
  sheetPrehled.setFrozenColumns(2);
  sheetPrehled.autoResizeColumns(1, header.length);
}