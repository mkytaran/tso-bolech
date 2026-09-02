// --- VSTUPNÍ BRÁNA PRO PROHLÍŽEČ (Otevření odkazu) ---
function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : "";
  if (action === "getInitialData") {
    return ContentService.createTextOutput(JSON.stringify(getInitialData()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput("API server Táborského symfonického orchestru Bolech běží v pořádku.")
    .setMimeType(ContentService.MimeType.TEXT);
}

// --- POMOCNÁ FUNKCE PRO ZÁPIS CHYB PŘÍMO DO TABULKY ---
function logError(title, msg) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Debug_Log");
    if (!sheet) { sheet = ss.insertSheet("Debug_Log"); }
    sheet.insertRowBefore(1);
    sheet.getRange("A1:C1").setValues([[new Date(), title, msg]]);
  } catch (e) {} // Pokud selže i tohle, nic se neděje
}

// --- 1. DISPEČER PRO EXTERNÍ APLIKACI (Čistý příjem JSON) ---
function doPost(e) {
  try {
    // Bezpečnostní pojistka
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: "Chybí data (postData)."}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    let request;
    try {
      request = JSON.parse(e.postData.contents);
    } catch(err) {
      logError("JSON Chyba", err.toString());
      return ContentService.createTextOutput(JSON.stringify({success: false, error: "Neplatná data ze serveru (nelze zpracovat JSON)."}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    let response = {};
    try {
      if (request.action === "authenticateMember") response = authenticateMember(request.payload);
      else if (request.action === "getInitialData") response = getInitialData();
      else if (request.action === "saveUcast") response = saveUcast(request.payload);
      else if (request.action === "saveAkce") response = saveAkce(request.payload);
      else if (request.action === "deleteAkce") response = deleteAkce(request.payload);
      else if (request.action === "updateNotyHromadne") response = updateNotyHromadne(request.payload);
      // NOVÉ PŘÍKAZY PRO HOSTY:
      else if (request.action === "requestGuestAccount") response = requestGuestAccount(request.payload);
      else if (request.action === "approveGuest") response = approveGuest(request.payload);
      else response = { success: false, error: "Neznámá akce: " + request.action };
    } catch (error) {
      // Zachycení specifické chyby při zpracování
      logError("Chyba při zpracování (" + (request.action || "neznámá") + ")", error.toString() + " | " + error.stack);
      response = { success: false, error: error.toString() };
    }

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
    
  } catch (fatalError) {
    // Kritické selhání úplně mimo kontrolu
    logError("Kritická chyba doPost", fatalError.toString());
    return ContentService.createTextOutput(JSON.stringify({success: false, error: fatalError.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- VYJEDNAVAČ PRO PROHLÍŽEČE (Řeší zbytečné CORS blokace) ---
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

// Pro povolení CORS (nutné pro volání z vnějšího webu)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

// --- 2. FUNKCE PRO PŘIHLAŠOVÁNÍ (S KONTROLOU PINU A EXPIRACE) ---
function authenticateMember(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Seznam členů"); 
  if (!sheet) return { success: false, error: "List 'Seznam členů' nebyl nalezen." };
  
  var data = sheet.getDataRange().getValues();
  var query = String(payload.query || "").toLowerCase().trim();
  var pin = String(payload.pin || "").trim();

  var headers = data[0];
  var nameCol = -1, surnameCol = -1, emailCol = -1, pinCol = -1, sectionCol = -1, roleCol = -1, platnostCol = -1;
  
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase().trim();
    if (h === "jméno") nameCol = i;
    if (h === "příjmení") surnameCol = i;
    if (h === "e-mail") emailCol = i;
    if (h === "pin") pinCol = i;
    if (h === "nástrojová sekce") sectionCol = i;
    if (h === "role") roleCol = i;
    if (h === "platnost do") platnostCol = i; // Nový sloupec pro expiraci
  }

  if (nameCol === -1 || pinCol === -1) return { success: false, error: "Sloupce Jméno a Pin nenalezeny." };

  for (var r = 1; r < data.length; r++) {
    var rowName = String(data[r][nameCol]).trim();
    var rowSurname = surnameCol > -1 ? String(data[r][surnameCol]).trim() : "";
    var fullName = (rowName + " " + rowSurname).toLowerCase().trim();
    var reversedName = (rowSurname + " " + rowName).toLowerCase().trim(); 
    var rowEmail = emailCol > -1 ? String(data[r][emailCol]).toLowerCase().trim() : "";
    var rowPin = String(data[r][pinCol]).trim();

    if ((query === rowEmail || query === fullName || query === reversedName || query === rowName.toLowerCase()) && query !== "") {
      if (pin === rowPin) {
         
         // ZÁCHRANA: Kontrola expirace účtu hosta
         if (platnostCol > -1 && data[r][platnostCol]) {
           var expDateText = data[r][platnostCol];
           var expDate = null;
           if (expDateText instanceof Date) { expDate = expDateText; }
           else {
             var parts = String(expDateText).split('-'); // Očekává formát YYYY-MM-DD
             if(parts.length === 3) expDate = new Date(parts[0], parts[1]-1, parts[2], 23, 59, 59);
           }
           
           if (expDate && Date.now() > expDate.getTime()) {
             return { success: false, error: "Platnost tohoto hostovského účtu vypršela." };
           }
         }

         return {
           success: true,
           member: {
             name: rowName + (rowSurname ? " " + rowSurname : ""),
             section: sectionCol > -1 ? String(data[r][sectionCol]).trim() : "",
             role: roleCol > -1 ? String(data[r][roleCol]).trim() : "",
             email: rowEmail
           }
         };
      } else return { success: false, error: "Nesprávný PIN kód." };
    }
  }
  return { success: false, error: "Jméno nebo e-mail nenalezen." };
}

// --- 3. NAČTENÍ DAT (AKCE, NOTY, ÚČAST) ---
function getInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
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
          id: String(row[0]), typ: row[1], nazev: row[2], misto: row[3], datum: datumVal,
          casOd: row[5] instanceof Date ? Utilities.formatDate(row[5], "Europe/Prague", "HH:mm") : row[5],
          casDo: row[6], casSrazu: row[7] instanceof Date ? Utilities.formatDate(row[7], "Europe/Prague", "HH:mm") : row[7],
          zacatekGeneralky: row[8] instanceof Date ? Utilities.formatDate(row[8], "Europe/Prague", "HH:mm") : row[8],
          uzavierka: row[9] instanceof Date ? Utilities.formatDate(row[9], "Europe/Prague", "d. M. yyyy") : row[9],
          damy: row[10], pani: row[11], poznamka: row[12]
        });
      }
    }
  }

  let noty = [];
  const sheetNoty = ss.getSheetByName("Noty");
  if (sheetNoty) {
    const dataNoty = sheetNoty.getDataRange().getValues();
    for (let i = 1; i < dataNoty.length; i++) {
      if (dataNoty[i][0]) {
        noty.push({ 
          skladba: String(dataNoty[i][0]), sekce: String(dataNoty[i][1]), 
          odkaz: String(dataNoty[i][2]), program: String(dataNoty[i][3]), aktivni: String(dataNoty[i][4])
        });
      }
    }
  }

  let ucast = [];
  const sheetUcast = ss.getSheetByName("Docházka a účast");
  if (sheetUcast) {
    const dataUcast = sheetUcast.getDataRange().getValues();
    for (let i = 1; i < dataUcast.length; i++) {
      if (dataUcast[i][1]) ucast.push({ akceId: String(dataUcast[i][1]), jmeno: dataUcast[i][3], sekce: dataUcast[i][4], stav: dataUcast[i][5], duvod: dataUcast[i][6] });
    }
  }

  // Načtení žádostí hostů (pouze těch nevyřízených)
  let zadostiHostu = [];
  const sheetZadosti = ss.getSheetByName("Žádosti hostů");
  if (sheetZadosti) {
    const dataZadosti = sheetZadosti.getDataRange().getValues();
    for (let i = 1; i < dataZadosti.length; i++) {
      if (dataZadosti[i][5] === "Nová") {
        zadostiHostu.push({
          rowIdx: i + 1, cas: dataZadosti[i][0], jmeno: dataZadosti[i][1], nastroj: dataZadosti[i][2], email: dataZadosti[i][3], telefon: dataZadosti[i][4]
        });
      }
    }
  }

  return { akce: akce, noty: noty, ucast: ucast, zadosti: zadostiHostu };

}

// --- ZBÝVAJÍCÍ FUNKCE ---
function saveUcast(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Docházka a účast");
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(payload.akceId) && String(data[i][3]) === String(payload.jmeno)) { rowIndex = i + 1; break; }
  }
  const timestamp = Utilities.formatDate(new Date(), "Europe/Prague", "d. M. yyyy HH:mm:ss");
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1).setValue(timestamp); sheet.getRange(rowIndex, 6).setValue(payload.stav); sheet.getRange(rowIndex, 7).setValue(payload.duvod || "");
  } else {
    sheet.appendRow([timestamp, payload.akceId, payload.datumAkce || "", payload.jmeno, payload.sekce, payload.stav, payload.duvod || ""]);
  }
  return { success: true };
}

function saveAkce(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Přehled akcí");
  const data = sheet.getDataRange().getValues();
  let akceId = payload.id ? String(payload.id).trim() : "";
  let rowIndex = -1;
  if (akceId) {
    for (let i = 1; i < data.length; i++) { if (String(data[i][0]).trim() === akceId) { rowIndex = i + 1; break; } }
  }
  if (rowIndex === -1) { akceId = "akce_" + new Date().getTime(); }
  const rowValues = [akceId, payload.typ || "", payload.nazev || "", payload.misto || "", payload.datum || "", payload.casOd || "", "", payload.casSrazu || "", payload.zacatekGeneralky || "", "", payload.damy || "", payload.pani || "", payload.poznamka || ""];
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  else sheet.appendRow(rowValues);
  return { success: true, id: akceId };
}

function deleteAkce(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Přehled akcí");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(payload.id).trim()) { sheet.deleteRow(i + 1); return { success: true }; }
  }
  return { success: false, error: "Akce nenalezena." };
}

// --- 8. HROMADNÉ ULOŽENÍ NOT Z APLIKACE (Chirurgický a bezpečný zápis) ---
function updateNotyHromadne(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Noty");
  if (!sheet) return { success: false, error: "List Noty nenalezen." };

  const data = sheet.getDataRange().getValues();
  const zmeny = payload.zmeny || [];
  
  if (zmeny.length === 0) return { success: true };

  const mapaZmen = {};
  zmeny.forEach(z => {
    if (z && z.odkaz) mapaZmen[String(z.odkaz).trim()] = z;
  });

  // ZÁCHRANA: Zapisujeme jen do konkrétních upravených buněk, ne do celé tabulky naráz!
  // Tímto absolutně eliminujeme riziko pádu paměti (OOM) na straně Google serverů.
  for (let i = 1; i < data.length; i++) {
    const odkazVTabulce = String(data[i][2]).trim();
    if (mapaZmen[odkazVTabulce]) {
      // i + 1 = přesný řádek v tabulce. Sloupec 4 je Program, sloupec 5 je Aktivni
      sheet.getRange(i + 1, 4).setValue(mapaZmen[odkazVTabulce].program);
      sheet.getRange(i + 1, 5).setValue(mapaZmen[odkazVTabulce].aktivni);
    }
  }
  
  return { success: true };
}

// ==============================================================================
// 9. SLOVNÍK NÁSTROJŮ A ZKRATEK PRO TŘÍDĚNÍ NOT
// ==============================================================================
const SLOVNIK_NASTROJU = {
  "1. Housle": ["1 housle", "housle 1", "violin 1", "violino 1", "1st violin", "vl 1", "vl i", "vno 1", "vno i", "violin i", "violino i", "violins 1", "violins i", "vn 1", "vn i", "violin e 1"],
  "2. Housle": ["2 housle", "housle 2", "violin 2", "violino 2", "2nd violin", "vl 2", "vl ii", "vno 2", "vno ii", "violin ii", "violino ii", "violins 2", "violins ii", "vn 2", "vn ii", "violin e 2"],
  "Housle": ["violin", "violins", "violino", "housle", "vn", "vno", "vl"],
  "Violy": ["viola", "violas", "vla", "va", "viol"],
  "Violoncella": ["cello", "violoncello", "vlc", "vc"],
  "Kontrabasy": ["bass", "contrabass", "cb", "basso", "kontrabas", "db"],
  "Flétny": ["flute", "flauto", "piccolo", "flétn", "fl", "picc"],
  "Hoboje": ["oboe", "corno inglese", "english horn", "hoboj", "ob", "c i", "eng horn", "hautbois", "htb", "htb 1", "htb 2"],
  "Klarinety / Saxofony": ["clarinet", "clarinette", "sax", "klarinet", "kl", "klar", "cl", "clar"],
  "Fagoty": ["bassoon", "fagotto", "fagot", "fg", "fag", "bsn", "basson"],
  "Lesní rohy": ["horn", "corno", "corni", "lesní roh", "cor", "hrn"],
  "Trubky": ["trumpet", "tromba", "trubk", "trp", "tr", "tpt"],
  "Trombóny a Tuba": ["trombone", "tuba", "pozoun", "trombón", "trb", "tbn", "pos"],
  "Bicí nástroje": ["timpani", "percussion", "piatti", "tamburo", "cymbals", "bicí", "pauken", "tambourine", "triangolo", "snare", "drum", "drums", "bd", "gran cassa", "glockenspiel", "xylofon", "xylophone", "zvonkohra", "vibraphone", "marimba", "campane", "chimes", "bici", "perc", "timp"],
  "Klávesy": ["piano", "keyboard", "klavír", "harp", "arpa", "harfa", "celesta", "cembalo", "cemballo", "organ", "varhany", "pno", "org"],
  "Kytary": ["guitar", "chitarra", "kytar", "guit"],
  "Zpěv": ["vocal", "choir", "coro", "soprano", "alto", "tenore", "basso", "zpěv", "vox", "voice"],
  "Partitura": ["score", "partitura", "direzione", "part"]
};

// ==============================================================================
// 10. FUNKCE PRO ODHAD SEKCE (Pomocí regulárních výrazů)
// ==============================================================================
function uhodniSekci(nazevSouboru) {
  let cistyNazev = nazevSouboru.toLowerCase();
  cistyNazev = cistyNazev.replace(/([a-zěščřžýáíéóúůďťň])([0-9])/g, '$1 $2');
  cistyNazev = cistyNazev.replace(/[-_.,()[\]]/g, ' ');

  for (const [sekce, klicovaSlova] of Object.entries(SLOVNIK_NASTROJU)) {
    for (const slovo of klicovaSlova) {
      const regex = new RegExp('\\b' + slovo + '\\b');
      if (regex.test(cistyNazev)) {
        return sekce;
      }
    }
  }
  return "??? K ROZTŘÍDĚNÍ ???";
}

// ==============================================================================
// 11. HLAVNÍ FUNKCE PRO NAČÍTÁNÍ NOT Z DISKU DO TABULKY (S pamětí proti timeoutu)
// ==============================================================================
function nactiNotyZDisku() {
  const slozkaId = '1xqZK2ZtOOAbGh6qIkyicdQeOQh2GErrN'; 
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const list = ss.getSheetByName('Noty');
  if (!list) {
    SpreadsheetApp.getUi().alert("Chyba: Nebyl nalezen list s názvem 'Noty'!");
    return;
  }
  
  const startCas = Date.now();
  const MAX_CAS_BEHU = 5 * 60 * 1000; 
  
  const posledniRadek = list.getLastRow();
  
  if (posledniRadek === 0) {
    list.appendRow(['Skladba', 'Sekce', 'Odkaz', 'Program', 'Aktivni']);
    list.getRange("A1:E1").setFontWeight("bold");
  }
  
  const existujiciOdkazy = new Set();
  if (posledniRadek > 1) {
    const ulozeneOdkazy = list.getRange(2, 3, posledniRadek - 1, 1).getValues();
    ulozeneOdkazy.forEach(radek => existujiciOdkazy.add(radek[0]));
  }
  
  const vlastnosti = PropertiesService.getDocumentProperties();
  const ulozenaFronta = vlastnosti.getProperty('FRONTA_SLOZEK');
  let fronta = [];
  
  if (ulozenaFronta) {
    fronta = JSON.parse(ulozenaFronta);
  } else {
    fronta.push({ id: slozkaId, cesta: "" });
  }
  
  const data = [];
  let limitDosazen = false;
  
  while (fronta.length > 0) {
    if (Date.now() - startCas > MAX_CAS_BEHU) {
      limitDosazen = true;
      break;
    }
    
    const aktualniPolozka = fronta.shift();
    let slozka;
    try {
      slozka = DriveApp.getFolderById(aktualniPolozka.id);
    } catch (e) {
      continue; 
    }
    
    const soubory = slozka.getFilesByType(MimeType.PDF);
    while (soubory.hasNext()) {
      const soubor = soubory.next();
      const odkaz = soubor.getUrl();
      
      if (existujiciOdkazy.has(odkaz)) continue;
      
      const nazevBezPdf = soubor.getName().replace('.pdf', ''); 
      const plnyNazev = aktualniPolozka.cesta ? `${aktualniPolozka.cesta} - ${nazevBezPdf}` : nazevBezPdf;
      const automatickaSekce = uhodniSekci(nazevBezPdf);
      
      data.push([plnyNazev, automatickaSekce, odkaz, 'Aktuální repertoár', 'ANO']);
    }
    
    const podslozky = slozka.getFolders();
    while (podslozky.hasNext()) {
      const podslozka = podslozky.next();
      const novaCesta = aktualniPolozka.cesta ? `${aktualniPolozka.cesta} / ${podslozka.getName()}` : podslozka.getName();
      
      fronta.push({ id: podslozka.getId(), cesta: novaCesta });
    }
  }
  
  if (data.length > 0) {
    list.getRange(list.getLastRow() + 1, 1, data.length, data[0].length).setValues(data);
  }
  
  if (limitDosazen) {
    vlastnosti.setProperty('FRONTA_SLOZEK', JSON.stringify(fronta));
    SpreadsheetApp.getUi().alert(
      `ČASOVÝ LIMIT GOOGLU!\n\nSkript se po 5 minutách bezpečně pozastavil. Zatím se přidalo ${data.length} nových not.\n\nPROSÍM, SPUSŤTE SKRIPT ZNOVU.`
    );
  } else {
    vlastnosti.deleteProperty('FRONTA_SLOZEK');
    SpreadsheetApp.getUi().alert(
      `HOTOVO - CELÝ ARCHIV PROŠEL!\n\nV tomto běhu bylo přidáno ${data.length} nových souborů.`
    );
  }
}

// ==============================================================================
// FUNKCE PRO SPRÁVU HOSTŮ A E-MAILY
// ==============================================================================

function requestGuestAccount(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Žádosti hostů");
  if (!sheet) { // Pokud list neexistuje, automaticky se vytvoří
    sheet = ss.insertSheet("Žádosti hostů");
    sheet.appendRow(["Čas žádosti", "Jméno", "Nástroj", "E-mail", "Telefon", "Stav"]);
    sheet.getRange("A1:F1").setFontWeight("bold");
  }
  const timestamp = Utilities.formatDate(new Date(), "Europe/Prague", "d. M. yyyy HH:mm");
  sheet.appendRow([timestamp, payload.jmeno, payload.nastroj, payload.email, payload.telefon || "", "Nová"]);
  return { success: true };
}

function approveGuest(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetClenove = ss.getSheetByName("Seznam členů");
  if (!sheetClenove) return { success: false, error: "List 'Seznam členů' nenalezen." };
  
  let jmeno = payload.jmeno.trim();
  if (!jmeno.toLowerCase().includes("host")) jmeno += " (Host)";
  
  // Vygenerování 4-místného pinu
  const pin = payload.pin || Math.floor(1000 + Math.random() * 9000).toString(); 
  
  // Nalezení sloupců
  const headers = sheetClenove.getRange(1, 1, 1, sheetClenove.getLastColumn()).getValues()[0];
  let newRow = new Array(headers.length).fill("");
  let expColIdx = -1;
  
  for(let i=0; i<headers.length; i++) {
    let h = String(headers[i]).toLowerCase().trim();
    if (h === "jméno") newRow[i] = jmeno;
    else if (h === "e-mail") newRow[i] = payload.email;
    else if (h === "pin") newRow[i] = pin;
    else if (h === "nástrojová sekce") newRow[i] = payload.nastroj;
    else if (h === "role") newRow[i] = "Host";
    else if (h === "platnost do") { expColIdx = i; newRow[i] = payload.expirace; }
  }
  
  // Pokud neexistuje sloupec "Platnost do", vytvoříme ho na konci
  if (expColIdx === -1) {
    sheetClenove.getRange(1, headers.length + 1).setValue("Platnost do");
    newRow.push(payload.expirace);
  }
  
  sheetClenove.appendRow(newRow);
  
  // Pokud šlo o schválení existující žádosti, změníme její stav
  if (payload.zadostRowIdx) {
    const sheetZadosti = ss.getSheetByName("Žádosti hostů");
    if (sheetZadosti) sheetZadosti.getRange(payload.zadostRowIdx, 6).setValue("Schváleno");
  }
  
  // ODESLÁNÍ E-MAILU HOSTOVI
  try {
    const subject = "Přístup do portálu orchestru TSO Bolech";
    // ZDE SI DOPLŇTE ODKAZ NA VAŠI APLIKACI:
    const urlAplikace = "https://mkytaran.github.io/tso-bolech/"; 
    
    const body = `Dobrý den,\n\nbyl Vám vytvořen hostovský účet do portálu Táborského symfonického orchestru Bolech.\n\n` +
                 `Adresa portálu: ${urlAplikace}\n` +
                 `Přihlašovací jméno: ${jmeno} (nebo tento e-mail)\n` +
                 `Váš PIN kód: ${pin}\n\n` +
                 `Účet je platný do: ${payload.expirace}\n\n` +
                 `Těšíme se na spolupráci!`;
                 
    MailApp.sendEmail(payload.email, subject, body);
  } catch(e) {
    logError("Chyba odeslání e-mailu hostovi", e.toString());
  }
  
  return { success: true, pin: pin };
}