// Registrace Service Workeru pro PWA (možnost instalace na plochu)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((registration) => {
      console.log('ServiceWorker úspěšně zaregistrován.');
    }).catch((error) => {
      console.log('Registrace ServiceWorkeru selhala: ', error);
    });
  });
}
// =========================================================================
// VAŠE URL ADRESA Z GOOGLE APPS SCRIPTU
// ========================================================================= 
const API_URL = "https://script.google.com/macros/s/AKfycbwVHLODjApvEPwE4RQo5nQxdr9Y8Ng-EoWTGGsH3l45L174huUMCh_99edIV-cbXQVHQQ/exec";

let user = null; 
let appData = { akce: [], noty: [], ucast: [] };

// =====================================================
// DEFINICE NÁSTROJŮ A SKUPIN ORCHESTRU
// =====================================================

// Hierarchie a řazení nástrojových skupin TSO Bolech
const ORCHESTR_SKUPINY = {
  "Smyčcové nástroje": ["1. Housle", "2. Housle", "Violy", "Violoncella", "Kontrabasy"],
  "Dechové nástroje": ["Flétny", "Hoboje", "Klarinety / Saxofony", "Fagoty", "Lesní rohy", "Trubky", "Trombóny a Tuba"],
  "Ostatní nástroje a zpěv": ["Bicí nástroje", "Klávesy", "Kytary", "Zpěv"],
  "Společné party": ["Smyčce", "Dechy", "Dřeva", "Žestě"],
  "Hosté": ["Hosté"]
};

// Hlavní ploché pole kategorií pro zobrazení
const PARTITURA_SECTIONS = [
  "1. Housle", "2. Housle", "Violy", "Violoncella", "Kontrabasy", 
  "Flétny", "Hoboje", "Klarinety / Saxofony", "Fagoty", "Lesní rohy", 
  "Trubky", "Trombóny a Tuba", "Bicí nástroje", "Klávesy", "Kytary", "Zpěv", 
  "Smyčce", "Dechy", "Dřeva", "Žestě", "Hosté"
];

// -----------------------------------------------------
// POMOCNÁ POLE PRO DETEKCI ZADANÝCH TEXTŮ A SKLOŇOVÁNÍ
// -----------------------------------------------------

const SMYCKE_SECTIONS = ["housl", "viol", "cell", "kontrabas", "smyčce", "smycce"];
const DECHOVE_SECTIONS = ["flétn", "hoboj", "klarinet", "saxofon", "fagot", "roh", "trubk", "trubc", "trombón", "trombon", "tuba", "tuby", "tubě", "tubou", "dech", "dřev", "žest"];
const HOSTE_SECTIONS = ["host"];

function initTheme() {
  const savedTheme = localStorage.getItem('bolech_theme');
  if (savedTheme === 'dark') { document.body.classList.add('dark-mode'); updateThemeIcon(true); }
}
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('bolech_theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}
function updateThemeIcon(isDark) {
  const icon = document.getElementById('theme-icon');
  if (isDark) icon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
  else icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
}
initTheme(); 

async function runGoogleScript(action, payload = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, payload: payload }),
      redirect: 'follow'
    });
    
    if (!response.ok) throw new Error('Chyba serveru: ' + response.status);
    return await response.json();
  } catch (error) {
    console.error("Detail chyby sítě:", error); 
    return { success: false, error: error.toString() };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("bolech_auth_member");
  if(saved) { user = JSON.parse(saved); initApp(); } 
  else { document.getElementById("loginScreen").style.display = "block"; }
});

function handleLoginSubmit(e) { 
  e.preventDefault(); 
  const btn = document.getElementById('loginBtn');
  btn.innerText = "Ověřuji..."; btn.disabled = true;
  runGoogleScript("authenticateMember", { query: document.getElementById('loginQuery').value, pin: document.getElementById('loginPin').value })
  .then(res => { 
    btn.innerText = "Vstoupit"; btn.disabled = false;
    if(res.success) { 
      user = res.member; 
      
      const jmeno = String(user.name || "").toLowerCase();
      const sekce = String(user.section || "").toLowerCase();
      const role = String(user.role || "").toLowerCase();
      
      if (sekce.includes('host') || jmeno.includes('host') || role === 'host') {
        const pocetDni = 14; 
        user.platnostDo = Date.now() + (pocetDni * 24 * 60 * 60 * 1000); 
      }

      localStorage.setItem('bolech_auth_member', JSON.stringify(user)); 
      document.getElementById('loginScreen').style.display = 'none'; 
      initApp(); 
    } else alert(res.error); 
  }); 
}

function initApp() {
  document.getElementById("mainApp").style.display = "block";
  document.getElementById("userBadge").innerText = user.name;
  
  const userRole = String(user.role || "").trim().toLowerCase();
  const povoleneRole = ['admin', 'dirigent', 'vedení', 'vedeni'];
  const isVedení = povoleneRole.includes(userRole);
  const jeDirigent = userRole === 'dirigent';
  
  if (isVedení) {
    document.getElementById('btn-nav-admin').style.display = 'flex';
  }

  const cachedData = localStorage.getItem("bolech_data_cache");
  if (cachedData) { 
    appData = JSON.parse(cachedData); 
    renderEvents(); 
    vykresliNoty(appData.noty || [], user.section, jeDirigent);
    if (isVedení) vykresliAdminNoty();
  }

  runGoogleScript("getInitialData").then(d => { 
    if(d.akce) {
      appData = d; 
      localStorage.setItem("bolech_data_cache", JSON.stringify(appData));
      renderEvents(); 
      vykresliNoty(appData.noty || [], user.section, jeDirigent);
      if (isVedení) vykresliAdminNoty();
    }
  });
}

function parseDate(dateStr) {
  if (!dateStr) return 0;
  const parts = String(dateStr).trim().split('.');
  if (parts.length >= 3) return new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0])).getTime();
  return new Date(dateStr).getTime() || 0;
}

function escapeHtml(str) { return String(str||'').replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag])); }

function generovatIdAkce(typ) {
  let prefix = 'akce_';
  const t = String(typ).toLowerCase();
  
  if (t.includes('koncert')) prefix = 'kon_';
  else if (t.includes('generálka')) prefix = 'gen_';
  else if (t.includes('zkouška') || t.includes('zkouska')) prefix = 'zk_'; 
  else if (t.includes('informace') || t.includes('oznámení')) prefix = 'info_';

  let max = 0;
  appData.akce.forEach(a => {
    if (a.id && String(a.id).startsWith(prefix)) {
      let num = parseInt(String(a.id).replace(prefix, ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  return prefix + String(max + 1).padStart(3, '0');
}

function isEventVisibleForUser(akce) {
  const typ = String(akce.typ || "").trim();
  const userSecL = String(user.section || "").toLowerCase();
  const userRole = String(user.role || "").trim().toLowerCase();
  
  if (typ.includes("Oznámení") || typ.includes("Informace")) return true; 
  if (userRole !== "" && userRole !== "-") return true; 
  if (typ === "Zkouška smyčců") return SMYCKE_SECTIONS.some(s => userSecL.includes(s));
  if (typ === "Zkouška dechů") return DECHOVE_SECTIONS.some(s => userSecL.includes(s));
  return true; 
}

function vykresliNoty(dataNoty, nastrojUzivatele, jeDirigent = false) {
  const kontejner = document.getElementById('notyContainer');
  const infoText = document.getElementById('notyNastrojInfo');
  
  if (!kontejner) return;

  const userRole = String(user.role || "").trim().toLowerCase();
  const isVedení = ['admin', 'dirigent', 'vedení', 'vedeni'].includes(userRole);

  if (infoText) {
    infoText.textContent = jeDirigent ? "Režim partitury" : `Zobrazený part: ${nastrojUzivatele}`;
  }

  let htmlDropdown = '';
  if (isVedení) {
    htmlDropdown = `
      <div style="margin-bottom: 20px; background: var(--bg); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
        <label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 8px; color: var(--text);">👀 Náhled partů (pouze pro vedení):</label>
        <select class="modal-input" onchange="zmenitPohledNot(this.value)" style="margin-bottom:0; font-size:14px; background: var(--surface);">
          <option value="Vlastní part" ${nastrojUzivatele === user.section ? 'selected' : ''}>Můj nástroj / Výchozí pohled (${user.section})</option>
          ${PARTITURA_SECTIONS.map(s => `<option value="${s}" ${nastrojUzivatele === s && nastrojUzivatele !== user.section ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    `;
  }

  const relevantniNoty = dataNoty.filter(nota => {
    let aktivni = String(nota.aktivni || '').toUpperCase().trim();
    if (aktivni !== 'TRUE' && aktivni !== 'ANO' && aktivni !== '1') return false;
    if (jeDirigent && nota.sekce === 'Partitura') return true;
    if (nota.sekce === nastrojUzivatele) return true;
    
    if (nota.sekce === 'Housle' && (nastrojUzivatele === '1. Housle' || nastrojUzivatele === '2. Housle')) return true;
    if (nota.sekce === 'Smyčce' && ['1. Housle', '2. Housle', 'Violy', 'Violoncella', 'Kontrabasy'].includes(nastrojUzivatele)) return true;
    if (nota.sekce === 'Dechy' && ['Flétny', 'Hoboje', 'Klarinety / Saxofony', 'Fagoty', 'Lesní rohy', 'Trubky', 'Trombóny a Tuba'].includes(nastrojUzivatele)) return true;
    if (nota.sekce === 'Dřeva' && ['Flétny', 'Hoboje', 'Klarinety / Saxofony', 'Fagoty'].includes(nastrojUzivatele)) return true;
    if (nota.sekce === 'Žestě' && ['Lesní rohy', 'Trubky', 'Trombóny a Tuba'].includes(nastrojUzivatele)) return true;
    return false;
  });

  let html = htmlDropdown;

  if (relevantniNoty.length === 0) {
    kontejner.innerHTML = html + '<p style="color: var(--text-muted); text-align: center; margin-top: 40px; padding: 20px;">Pro tento part aktuálně nejsou k dispozici žádné noty na repertoáru.</p>';
    return;
  }

  const notyPodleProgramu = {};
  relevantniNoty.forEach(nota => {
    const program = nota.program || 'Ostatní repertoár';
    if (!notyPodleProgramu[program]) notyPodleProgramu[program] = [];
    notyPodleProgramu[program].push(nota);
  });

  for (const [program, noty] of Object.entries(notyPodleProgramu)) {
    let mujEmail = user.email || '';
    if (!mujEmail && appData.clenove) {
      const ja = appData.clenove.find(c => c.jmeno === user.name || c.name === user.name);
      if (ja && ja.email) mujEmail = ja.email.trim();
    }
    
    let emailPredmet = encodeURIComponent(`Noty TSO Bolech - ${program}`);
    let emailTelo = `Dobrý den,\n\nzasílám odkazy pro přímé stažení not (Program: ${program}, Part: ${nastrojUzivatele}).\n\n`;
    noty.forEach(n => {
      let stahovaciOdkaz = n.odkaz.replace(/.*\/d\/([a-zA-Z0-9_-]+).*/, 'https://drive.google.com/uc?export=download&id=$1');
      emailTelo += `- ${n.skladba}:\n  ${stahovaciOdkaz}\n\n`;
    });
    emailTelo += `Portál TSO Bolech`;
    let mailtoOdkaz = `mailto:${mujEmail}?subject=${emailPredmet}&body=${encodeURIComponent(emailTelo)}`;

    html += `
      <div class="program-header">
        <h3 class="program-title">${program}</h3>
        <a href="${mailtoOdkaz}" class="email-btn" title="Přeposlat odkazy na svůj e-mail">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
          Přeposlat sobě
        </a>
      </div>`;
      
    noty.forEach(nota => {
      html += `
        <div class="nota-card">
          <div class="nota-info">
            <h4>${nota.skladba}</h4>
            <span>${nota.sekce}</span>
          </div>
          <a href="${nota.odkaz.replace(/.*\/d\/([a-zA-Z0-9_-]+).*/, 'https://drive.google.com/uc?export=download&id=$1')}" target="_blank" class="nota-down-btn" title="Stáhnout">
            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </a>
        </div>`;
    });
  }
  
  kontejner.innerHTML = html;
}

// --- PARSOVÁNÍ STRUKTURY POZNÁMKY (HLAVNÍ TEXT, HARMONOGRAM, PROGRAM) ---
function parsovatPoznamku(rawNote) {
  let mainNote = rawNote || '';
  let schedData = '';
  let progData = '';

  if (mainNote.includes('===HARMONOGRAM===')) {
    let partsH = mainNote.split('===HARMONOGRAM===');
    mainNote = partsH[0].trim();
    let rest = partsH[1].trim();
    if (rest.includes('===PROGRAM===')) {
      let partsP = rest.split('===PROGRAM===');
      schedData = partsP[0].trim();
      progData = partsP[1].trim();
    } else {
      schedData = rest;
    }
  } else if (mainNote.includes('===PROGRAM===')) {
    let partsP = mainNote.split('===PROGRAM===');
    mainNote = partsP[0].trim();
    progData = partsP[1].trim();
  }

  return { mainNote, schedData, progData };
}

// --- VYKRESLENÍ HARMONOGRAMU ---
function formatHarmonogramHtml(sData) {
  if (!sData) return '';
  let html = `<div style="margin-top:20px; padding-top:16px; border-top: 1px dashed var(--border);">
      <h4 style="margin-top:0; margin-bottom:12px; font-size:18px; color:var(--text);">⏱️ Časový plán</h4>
      <table style="width:100%; border-collapse: collapse; font-size:16px;">`;
  sData.split('\n').forEach((line, index, arr) => {
      let p = line.split('|');
      let time = escapeHtml(p[0]||'').trim();
      let desc = escapeHtml(p[1]||'').trim().replace(/\[BR\]/g, '<br>');
      let borderObj = (index === arr.length - 1) ? 'none' : '1px solid var(--border)';
      
      html += `<tr>
          <td style="padding:8px 12px 8px 0; vertical-align:top; text-align:right; border-bottom:${borderObj}; white-space:nowrap; font-weight:bold; width:1%; color:var(--text);">${time}</td>
          <td style="padding:8px 0; vertical-align:top; border-bottom:${borderObj}; color:var(--text);">${desc}</td>
      </tr>`;
  });
  html += `</table></div>`;
  return html;
}

// --- VYKRESLENÍ ŠABLONY PROGRAMU NA ZADNÍ STRANĚ KARTY ---
function formatProgramHtml(pData) {
  if (!pData) return '';
  let rows = '';
  pData.split('\n').forEach(line => {
    let parts = line.split('|');
    if (parts.length >= 2) {
      let num = escapeHtml(parts[0] || '').trim();
      let author = escapeHtml(parts[1] || '').trim();
      let piece = escapeHtml(parts[2] || '').trim();
      rows += `
        <tr>
          <td class="col-num">${num ? num + '.' : ''}</td>
          <td class="col-author">${author}</td>
          <td class="col-piece">${piece}</td>
        </tr>
      `;
    }
  });

  if (!rows) return '';

  return `
    <div style="margin-top: 10px;">
      <h4 style="margin-bottom: 8px; font-size: 16px; color: var(--text);">🎼 Program / Pořadí skladeb</h4>
      <table class="program-table">
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th class="col-author">Skladatel</th>
            <th class="col-piece">Dílo / Skladba</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

let aktivniOtocenaKartaId = null;

function flipCard(cardId) {
  const flipper = document.getElementById(cardId);
  const backdrop = document.getElementById('card-backdrop');
  if (!flipper) return;

  const container = flipper.closest('.card-flip-container');
  const isCurrentlyFlipped = flipper.classList.contains('is-flipped');

  if (!isCurrentlyFlipped) {
    if (aktivniOtocenaKartaId && aktivniOtocenaKartaId !== cardId) {
      zavritOtocenouKartu();
    }
    
    flipper.classList.add('is-flipped');
    if (container) container.classList.add('active-focus');
    if (backdrop) backdrop.classList.add('active');
    document.body.classList.add('card-flipped-active'); // Rozmaže zbytek stránky
    aktivniOtocenaKartaId = cardId;
  } else {
    flipper.classList.remove('is-flipped');
    if (container) container.classList.remove('active-focus');
    if (backdrop) backdrop.classList.remove('active');
    document.body.classList.remove('card-flipped-active'); // Odstraní rozmazání
    aktivniOtocenaKartaId = null;
  }
}

function zavritOtocenouKartu() {
  if (aktivniOtocenaKartaId) {
    flipCard(aktivniOtocenaKartaId);
  }
}

function renderEvents() {
  const cont = document.getElementById("eventsContainer"); cont.innerHTML = "";
  const archCont = document.getElementById("archiveContainer"); archCont.innerHTML = "";
  const userRole = String(user.role||"").trim().toLowerCase();
  
  const povoleneRole = ['admin', 'dirigent', 'vedení', 'vedeni'];
  const isVedení = povoleneRole.includes(userRole);
  
  if (isVedení) {
    cont.innerHTML += `
      <div style="display:flex; gap:12px; margin-bottom:16px;">
        <button class="btn" style="background:var(--success); flex:1;" onclick="openAkceForm()">➕ Přidat akci</button>
        <button class="btn" style="background:var(--primary-light); flex:1;" onclick="openGuestManager()">👥 Správa hostů</button>
      </div>`;
  }

  const vsechnyViditelne = appData.akce.filter(a => isEventVisibleForUser(a));
  
  const aktivniOznameni = vsechnyViditelne.filter(a => a.typ === 'Oznámení' || a.typ === 'Informace').sort((a,b) => parseDate(b.datum) - parseDate(a.datum));
  const akceNorm = vsechnyViditelne.filter(a => !a.typ.includes('Oznámení') && !a.typ.includes('Informace')).sort((a,b) => parseDate(b.datum) - parseDate(a.datum));
  const archiv = vsechnyViditelne.filter(a => a.typ === 'Oznámení (Archiv)' || a.typ === 'Informace (Infoarchiv)').sort((a,b) => parseDate(b.datum) - parseDate(a.datum));

  aktivniOznameni.forEach(a => cont.innerHTML += generateOznameniHtml(a, isVedení));
  
  if(akceNorm.length === 0 && aktivniOznameni.length === 0) {
    cont.innerHTML += `<div style="text-align:center; padding:40px; color:var(--text-muted);">Zatím nejsou naplánovány žádné akce.</div>`;
  } else {
    akceNorm.forEach(a => cont.innerHTML += generateAkceHtml(a, isVedení));
  }

  if(archiv.length === 0) archCont.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">Infoarchiv je prázdný.</div>`;
  else archiv.forEach(a => archCont.innerHTML += generateOznameniHtml(a, isVedení, true));
}

function generateAkceHtml(akce, isVedení) {
  const myVote = (appData.ucast||[]).find(u => String(u.akceId) === String(akce.id) && u.jmeno === user.name);
  let barClass = 'bar-tutti';
  if(akce.typ === 'Koncert') barClass = 'bar-koncert';
  else if(akce.typ === 'Generálka') barClass = 'bar-generalka';
  else if(akce.typ === 'Zkouška smyčců') barClass = 'bar-zkouska-smycce';
  else if(akce.typ === 'Zkouška dechů') barClass = 'bar-zkouska-dechy';
  
  let editBtn = isVedení ? `<button class="edit-btn" onclick='openAkceForm(${JSON.stringify(akce).replace(/'/g, "&#39;")})'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>` : "";

  const parsed = parsovatPoznamku(akce.poznamka);
  const hasProgram = !!parsed.progData;
  const hasDetailsOnBack = hasProgram || !!parsed.mainNote;
  const cardFlipperId = `flipper-${akce.id}`;

  return `
    <div class="card-flip-container">
      <div class="card-flipper" id="${cardFlipperId}">
        
        <!-- PŘEDNÍ STRANA KARTY -->
        <div class="card-front">
          ${hasDetailsOnBack ? `<button type="button" class="corner-fold-btn" onclick="flipCard('${cardFlipperId}')" title="Zobrazit program a detaily"></button>` : ''}
          <div class="card-top-bar ${barClass}"><span>${akce.typ}</span><span>🗓️ ${akce.datum}</span></div>
          <div class="card-body">
            <div class="card-title-row"><div class="card-title">${akce.nazev}</div>${editBtn}</div>
            ${akce.misto ? `<p style="margin-bottom:6px;">📍 ${akce.misto}</p>` : ''}
            <p style="margin-bottom:6px;">🕒 Začátek: <strong>${akce.casOd}</strong></p>
            ${akce.casSrazu ? `<p style="margin-bottom:6px;">⏰ Sraz: <strong>${akce.casSrazu}</strong></p>` : ''}
            ${akce.zacatekGeneralky ? `<p style="margin-bottom:6px;">🎻 Generálka: <strong>${akce.zacatekGeneralky}</strong></p>` : ''}
            ${akce.damy ? `<p style="margin-bottom:6px;">👗 Dámy: ${akce.damy}</p>` : ''}
            ${akce.pani ? `<p style="margin-bottom:6px;">🤵 Páni: ${akce.pani}</p>` : ''}
            
            ${formatHarmonogramHtml(parsed.schedData)}

            <div class="att-buttons" style="margin-top:16px;">
              <button class="btn-att ${myVote?.stav==='Ano'?'selected-ano':''}" onclick="submitUcast('${akce.id}','${akce.datum}','Ano',this)">✓ Účastním se</button>
              <button class="btn-att ${myVote?.stav==='Ne'?'selected-ne':''}" onclick="submitUcast('${akce.id}','${akce.datum}','Ne',this)">✕ Neúčastním</button>
            </div>
            <div id="duvod-${akce.id}" class="duvod-box" style="display:${myVote?.stav==='Ne'&&!myVote?.duvod?'block':'none'}">
              <input type="text" id="in-${akce.id}" placeholder="Důvod neúčasti" class="modal-input" style="margin-bottom:12px;">
              <button class="btn" onclick="saveDuvod('${akce.id}','${akce.datum}',this)">Odeslat důvod</button>
            </div>
            <div id="roster-container-${akce.id}">${generateRosterHtml(akce.id)}</div>
          </div>
        </div>

        <!-- ZADNÍ STRANA KARTY (PROGRAM & PODROBNOSTI) -->
        <div class="card-back">
          <div class="card-top-bar ${barClass}">
            <span>DETAILY & PROGRAM</span>
            <button type="button" class="btn-flip-back" onclick="flipCard('${cardFlipperId}')">✕ Zpět na přehled</button>
          </div>
          <div class="card-body">
            ${parsed.mainNote ? `<div class="oznameni-text" style="margin-bottom: 16px;">${escapeHtml(parsed.mainNote)}</div>` : ''}
            ${formatProgramHtml(parsed.progData)}
          </div>
        </div>

      </div>
    </div>`;
}

function generateOznameniHtml(akce, isVedení, isArchiv = false) {
  let editBtn = isVedení ? `<button class="edit-btn" onclick='openAkceForm(${JSON.stringify(akce).replace(/'/g, "&#39;")})'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>` : "";
  
  let akceBtn = "";
  if (isVedení) {
    if (!isArchiv) {
      akceBtn = `<button class="btn" style="background:transparent; color:var(--text-muted); border:1px solid var(--border); padding:8px; margin-top:16px; font-size:14px;" onclick="archivovatOznameni('${akce.id}')">🗃️ Přesunout do infoarchivu</button>`;
    } else {
      akceBtn = `<button class="btn" style="background:transparent; color:var(--primary-light); border:1px solid var(--primary-light); padding:8px; margin-top:16px; font-size:14px;" onclick="obnovitOznameni('${akce.id}')">↩️ Vrátit zpět na hlavní stránku</button>`;
    }
  }

  const parsed = parsovatPoznamku(akce.poznamka);
  
  return `
    <div class="card card-oznameni">
      <div class="card-top-bar bar-oznameni"><span>💡 Informace</span><span>🗓️ ${akce.datum}</span></div>
      <div class="card-body" style="padding-top:12px;">
        <div class="card-title-row" style="margin-bottom:4px;"><div class="card-title" style="font-size:20px;">${akce.nazev}</div>${editBtn}</div>
        ${parsed.mainNote ? `<div class="oznameni-text" style="margin-top:12px;">${escapeHtml(parsed.mainNote)}</div>` : ''}
        ${formatHarmonogramHtml(parsed.schedData)}
        ${formatProgramHtml(parsed.progData)}
        ${akceBtn}
      </div>
    </div>`;
}

function archivovatOznameni(akceId) {
  if(confirm("Přesunout tuto informaci do infoarchivu? Zmizí z hlavní stránky.")) {
    const akce = appData.akce.find(a => String(a.id) === String(akceId));
    if(!akce) return;
    akce.typ = 'Informace (Infoarchiv)';
    runGoogleScript("saveAkce", akce).then(res => {
      if(res.success) { localStorage.setItem("bolech_data_cache", JSON.stringify(appData)); renderEvents(); }
    });
  }
}

function obnovitOznameni(akceId) {
  const akce = appData.akce.find(a => String(a.id) === String(akceId));
  if(!akce) return;
  akce.typ = 'Informace';
  runGoogleScript("saveAkce", akce).then(res => {
    if(res.success) { localStorage.setItem("bolech_data_cache", JSON.stringify(appData)); renderEvents(); }
  });
}

function generateRosterHtml(akceId) {
  const potvrdili = (appData.ucast || []).filter(u => String(u.akceId) === String(akceId) && u.stav === 'Ano');
  const grouped = {};
  potvrdili.forEach(p => {
    let hracSekce = String(p.sekce || "Ostatní").trim().toLowerCase();
    let nalezenaSekce = PARTITURA_SECTIONS.find(s => s.toLowerCase().includes(hracSekce) || hracSekce.includes(s.toLowerCase())) || "Ostatní / Hosté";
    if (!grouped[nalezenaSekce]) grouped[nalezenaSekce] = [];
    grouped[nalezenaSekce].push(p.jmeno);
  });
  let html = `<button class="roster-toggle" onclick="toggleRoster('${akceId}')"><span>👥 Přihlášeno (${potvrdili.length})</span><span id="arrow-${akceId}">▼</span></button><div id="content-${akceId}" class="roster-content">`;
  PARTITURA_SECTIONS.forEach(s => { if (grouped[s]) html += `<div class="roster-section"><div class="roster-section-title">${s}</div><div class="roster-members">${grouped[s].join(', ')}</div></div>`; });
  if (grouped["Ostatní / Hosté"]) html += `<div class="roster-section"><div class="roster-section-title">Ostatní / Hosté</div><div class="roster-members">${grouped["Ostatní / Hosté"].join(', ')}</div></div>`;
  if (potvrdili.length === 0) html += '<div style="font-size:15px; color:var(--text-muted); font-style:italic; padding:8px 0;">Zatím nikdo nepotvrdil účast.</div>';
  return html + '</div>';
}

function toggleRoster(id) { 
  const content = document.getElementById('content-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (content.style.display === 'block') { content.style.display = 'none'; arrow.innerText = '▼'; } 
  else { content.style.display = 'block'; arrow.innerText = '▲'; }
}

function submitUcast(id, datum, stav, btn) { 
  const origText = btn.innerText; btn.innerText = "Ukládám...";
  runGoogleScript("saveUcast", {akceId: id, datumAkce: datum, jmeno: user.name, sekce: user.section, stav: stav})
  .then(res => {
    btn.innerText = origText;
    if(res.success) {
      document.getElementById('duvod-'+id).style.display = (stav === 'Ne') ? 'block' : 'none'; 
      btn.parentElement.querySelectorAll('.btn-att').forEach(b => b.className = 'btn-att'); 
      btn.classList.add(stav === 'Ano' ? 'selected-ano' : 'selected-ne');
      let exist = appData.ucast.find(u => u.akceId === id && u.jmeno === user.name);
      if(exist) exist.stav = stav; else appData.ucast.push({akceId:id, jmeno:user.name, sekce:user.section, stav:stav});
      document.getElementById('roster-container-'+id).innerHTML = generateRosterHtml(id);
      localStorage.setItem("bolech_data_cache", JSON.stringify(appData));
    }
  });
}

function saveDuvod(id, datum, btn) { 
  const duvod = document.getElementById('in-'+id).value; btn.innerText = "Ukládám...";
  runGoogleScript("saveUcast", {akceId: id, datumAkce: datum, jmeno: user.name, sekce: user.section, stav: 'Ne', duvod: duvod})
  .then(res => {
    btn.innerText = "Odeslat důvod";
    if(res.success) { document.getElementById('duvod-'+id).style.display = 'none'; }
  });
}

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).trim().split('.');
  if (parts.length === 3) {
    const d = parts[0].trim().padStart(2, '0');
    const m = parts[1].trim().padStart(2, '0');
    const y = parts[2].trim();
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

function formatDateForSave(isoDate) {
  if (!isoDate) return "";
  const parts = String(isoDate).split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
  }
  return isoDate;
}

// --- PŘIDÁVÁNÍ ŘÁDKŮ HARMONOGRAMU DO FORMULÁŘE ---
function addScheduleRow(time = '', desc = '') {
  const cont = document.getElementById('schedule-rows');
  if (!cont) return;
  const div = document.createElement('div');
  div.style = 'border: 1px dashed var(--border); padding: 8px; margin-bottom: 8px; border-radius: 6px; position: relative;';
  div.innerHTML = `
    <button type="button" style="position: absolute; top: 8px; right: 8px; background: transparent; border: 1px solid var(--danger); border-radius: 4px; color: var(--danger); font-size: 12px; padding: 2px 6px;" onclick="this.parentElement.remove()">✕</button>
    <div style="margin-top: 20px;">
        <label style="font-size: 12px; display: block; margin-bottom: 2px;">Čas (od - do):</label>
        <input type="text" class="modal-input sched-time" placeholder="např. 10:00 - 12:30" value="${escapeHtml(time)}" style="margin-bottom: 6px; padding: 6px 8px; font-size: 14px;">
        <label style="font-size: 12px; display: block; margin-bottom: 2px;">Popis programu:</label>
        <textarea class="modal-input sched-desc" placeholder="např. Dopolední zkouška" rows="2" style="padding: 6px 8px; font-size: 14px; min-height: 50px; resize: vertical;">${escapeHtml(desc).replace(/\[BR\]/g, '\n')}</textarea>
    </div>
  `;
  cont.appendChild(div);
}

// --- PŘIDÁVÁNÍ ŘÁDKŮ PROGRAMU DO FORMULÁŘE ---
function addProgramRow(num = '', author = '', piece = '') {
  const cont = document.getElementById('program-rows');
  if (!cont) return;
  const div = document.createElement('div');
  div.style = 'border: 1px dashed var(--border); padding: 8px; margin-bottom: 8px; border-radius: 6px; position: relative; display: flex; gap: 8px; align-items: flex-start;';
  div.innerHTML = `
    <div style="width: 48px;">
      <label style="font-size: 11px; display: block;">Poř.</label>
      <input type="text" class="modal-input prog-num" placeholder="1" value="${escapeHtml(num)}" style="padding: 6px; font-size: 13px; text-align: center;">
    </div>
    <div style="flex: 1;">
      <label style="font-size: 11px; display: block;">Autor / Skladatel:</label>
      <input type="text" class="modal-input prog-author" placeholder="např. B. Smetana" value="${escapeHtml(author)}" style="padding: 6px 8px; font-size: 14px;">
    </div>
    <div style="flex: 2;">
      <label style="font-size: 11px; display: block;">Dílo / Skladba:</label>
      <input type="text" class="modal-input prog-piece" placeholder="např. Má vlast - Vltava" value="${escapeHtml(piece)}" style="padding: 6px 8px; font-size: 14px;">
    </div>
    <button type="button" style="margin-top: 18px; background: transparent; border: 1px solid var(--danger); border-radius: 4px; color: var(--danger); font-size: 12px; padding: 6px 8px;" onclick="this.parentElement.remove()">✕</button>
  `;
  cont.appendChild(div);
}

function openAkceForm(akce = null) {
  const isEdit = akce !== null;
  const selectDisabledAttr = isEdit ? 'disabled style="background: var(--bg); opacity: 0.8;"' : '';
  const formDateValue = formatDateForInput(akce?.datum || '');
  
  const parsed = parsovatPoznamku(akce?.poznamka || '');
  let scheduleLines = [];
  if (parsed.schedData) {
    scheduleLines = parsed.schedData.split('\n').map(line => {
      let p = line.split('|');
      return { time: p[0]||'', desc: p[1]||'' };
    });
  }

  let programLines = [];
  if (parsed.progData) {
    programLines = parsed.progData.split('\n').map(line => {
      let p = line.split('|');
      return { num: p[0]||'', author: p[1]||'', piece: p[2]||'' };
    });
  }

  const html = `
        <div id="akceModal" class="modal-overlay">
          <div class="modal-box" style="max-height: 90vh; overflow-y: auto;">
            
            <div style="display:flex; align-items:center; margin-bottom: 20px;">
              <button type="button" style="background:transparent; border:none; font-size:16px; color:var(--text); padding:8px 16px 8px 0; margin-right:8px; cursor:pointer; display:flex; align-items:center; gap:6px;" onclick="document.getElementById('akceModal').remove()">
                <span style="font-size:24px; line-height:1;">←</span> Zpět
              </button>
              <h3 style="margin:0; font-size:20px;">${isEdit ? 'Úprava položky' : 'Nová položka'}</h3>
            </div>
            
            <form id="editAkceForm" onsubmit="submitAkceForm(event, '${isEdit ? escapeHtml(akce.id) : ''}')"> 
          <label>Typ:</label>
          <select id="f_typ" class="modal-input" onchange="toggleAkceFields()" ${selectDisabledAttr}>
            <option value="Tutti zkouška" ${akce?.typ==='Tutti zkouška'?'selected':''}>Tutti zkouška</option>
            <option value="Zkouška smyčců" ${akce?.typ==='Zkouška smyčců'?'selected':''}>Zkouška smyčců</option>
            <option value="Zkouška dechů" ${akce?.typ==='Zkouška dechů'?'selected':''}>Zkouška dechů</option>
            <option value="Generálka" ${akce?.typ==='Generálka'?'selected':''}>Generálka</option>
            <option value="Koncert" ${akce?.typ==='Koncert'?'selected':''}>Koncert</option>
            <option value="Informace" ${(akce?.typ==='Informace' || akce?.typ==='Oznámení') ? 'selected' : ''}>Informace</option>
            <option value="Informace (Infoarchiv)" ${(akce?.typ==='Informace (Infoarchiv)' || akce?.typ==='Oznámení (Archiv)') ? 'selected' : ''}>Informace (Infoarchiv)</option>
          </select>

          <label>Název / Nadpis oznámení:</label>
          <input type="text" id="f_nazev" value="${escapeHtml(akce?.nazev||'')}" required class="modal-input">

          <div style="display:flex; gap:12px;">
            <div style="flex:1;">
              <label>Datum:</label>
              <input type="date" id="f_datum" value="${escapeHtml(formDateValue)}" required class="modal-input">
            </div>
            <div id="col_casOd" style="flex:1;">
              <label>Čas od:</label>
              <input type="time" id="f_casOd" value="${escapeHtml(akce?.casOd||'')}" class="modal-input">
            </div>
          </div>

          <div id="row_misto" style="display:block;">
            <label>Místo:</label>
            <input type="text" id="f_misto" value="${escapeHtml(akce?.misto||'')}" class="modal-input">
          </div>

          <div id="row_casy" style="display:flex; gap:12px;">
            <div style="flex:1;">
              <label>Čas srazu:</label>
              <input type="time" id="f_casSrazu" value="${escapeHtml(akce?.casSrazu||'')}" class="modal-input">
            </div>
            <div id="col_generalka" style="flex:1;">
              <label>Čas generálky:</label>
              <input type="time" id="f_zacatekGeneralky" value="${escapeHtml(akce?.zacatekGeneralky||'')}" class="modal-input">
            </div>
          </div>

          <div id="row_obleceni" style="display:flex; gap:12px;">
            <div style="flex:1;">
              <label>Dámy (oděv):</label>
              <input type="text" id="f_damy" value="${escapeHtml(akce?.damy||'')}" class="modal-input">
            </div>
            <div style="flex:1;">
              <label>Páni (oděv):</label>
              <input type="text" id="f_pani" value="${escapeHtml(akce?.pani||'')}" class="modal-input">
            </div>
          </div>

          <label>Hlavní text (Poznámka / organizační info):</label>
          <textarea id="f_poznamka" class="modal-input" style="min-height:100px; resize:vertical;">${escapeHtml(parsed.mainNote)}</textarea>

          <!-- Sekce pro harmonogram -->
          <div style="margin-top: 16px; background: var(--bg); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
              <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                  <span style="font-weight:bold; color:var(--text);">⏱️ Připojit časový plán</span>
                  <button type="button" class="btn" style="padding:6px 12px; font-size:13px; background:var(--primary-light);" onclick="addScheduleRow()">➕ Přidat čas</button>
              </label>
              <div id="schedule-rows"></div>
          </div>

          <!-- Sekce pro program skladeb (na zadní stranu) -->
          <div style="margin-top: 16px; background: var(--bg); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
              <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                  <span style="font-weight:bold; color:var(--text);">🎼 Program skladeb (zadní strana karty)</span>
                  <button type="button" class="btn" style="padding:6px 12px; font-size:13px; background:var(--primary-light);" onclick="addProgramRow()">➕ Přidat skladbu</button>
              </label>
              <div id="program-rows"></div>
          </div>

          <div style="display:flex; gap:12px; margin-top:24px; flex-wrap:wrap;">
            <button type="submit" id="btnSaveModal" class="btn" style="flex:1; min-width:120px;">Uložit</button>
            <button type="button" class="btn" style="background:var(--border); color:var(--text); flex:1; min-width:120px;" onclick="document.getElementById('akceModal').remove()">Zrušit</button>
            ${isEdit ? `<button type="button" class="btn" style="background:var(--danger); color:white; width:100%; margin-top:8px;" onclick="deleteAkcePrompt('${escapeHtml(akce.id)}')">🗑 Smazat položku</button>` : ''}
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  toggleAkceFields(); 
  
  scheduleLines.forEach(s => addScheduleRow(s.time, s.desc));
  programLines.forEach(p => addProgramRow(p.num, p.author, p.piece));
}

function toggleAkceFields() {
  const typ = document.getElementById('f_typ').value;
  const jeOznameni = typ.includes('Oznámení') || typ.includes('Informace');
  const jeZkouska = typ.includes('zkouška') || typ.includes('Zkouška');
  
  document.getElementById('row_misto').style.display = jeOznameni ? 'none' : 'block';
  document.getElementById('col_casOd').style.display = jeOznameni ? 'none' : 'block';
  document.getElementById('row_casy').style.display = (jeZkouska || jeOznameni) ? 'none' : 'flex';
  document.getElementById('row_obleceni').style.display = (typ === 'Koncert') ? 'flex' : 'none';
  document.getElementById('col_generalka').style.display = (typ === 'Koncert') ? 'block' : 'none';
}

function submitAkceForm(e, akceId) {
  e.preventDefault();
  document.getElementById('btnSaveModal').innerText = "Ukládám...";
  
  const typ = document.getElementById('f_typ').value;
  const jeOznameni = typ.includes('Oznámení') || typ.includes('Informace');
  const jeZkouska = typ.includes('zkouška') || typ.includes('Zkouška');
  const finalId = akceId || generovatIdAkce(typ);

  let finalPoznamka = document.getElementById('f_poznamka').value.trim();
  
  // Harmonogram
  const schedTimes = document.querySelectorAll('.sched-time');
  const schedDescs = document.querySelectorAll('.sched-desc');
  let schedText = "";
  for(let i = 0; i < schedTimes.length; i++) {
    let t = schedTimes[i].value.trim();
    let d = schedDescs[i].value.trim().replace(/\n/g, '[BR]');
    if(t || d) schedText += `\n${t}|${d}`;
  }
  if (schedText !== "") {
    finalPoznamka += `\n\n===HARMONOGRAM===${schedText}`;
  }

  // Program skladeb
  const progNums = document.querySelectorAll('.prog-num');
  const progAuthors = document.querySelectorAll('.prog-author');
  const progPieces = document.querySelectorAll('.prog-piece');
  let progText = "";
  for(let i = 0; i < progPieces.length; i++) {
    let num = progNums[i].value.trim();
    let author = progAuthors[i].value.trim();
    let piece = progPieces[i].value.trim();
    if (author || piece) {
      progText += `\n${num}|${author}|${piece}`;
    }
  }
  if (progText !== "") {
    finalPoznamka += `\n\n===PROGRAM===${progText}`;
  }

  const payload = {
    id: finalId, typ: typ, nazev: document.getElementById('f_nazev').value, 
    datum: formatDateForSave(document.getElementById('f_datum').value), 
    misto: jeOznameni ? "" : document.getElementById('f_misto').value,
    casOd: jeOznameni ? "" : document.getElementById('f_casOd').value,
    casSrazu: (jeZkouska || jeOznameni) ? "" : document.getElementById('f_casSrazu').value,
    zacatekGeneralky: typ !== 'Koncert' ? "" : document.getElementById('f_zacatekGeneralky').value,
    damy: typ !== 'Koncert' ? "" : document.getElementById('f_damy').value, pani: typ !== 'Koncert' ? "" : document.getElementById('f_pani').value,
    poznamka: finalPoznamka
  };
  
  runGoogleScript("saveAkce", payload).then(res => {
    if (res.success) { 
      document.getElementById('akceModal').remove(); 
      localStorage.removeItem("bolech_data_cache");
      initApp(); 
    } 
    else { alert('Chyba: ' + res.error); document.getElementById('btnSaveModal').innerText = "Uložit"; }
  });
}

function deleteAkcePrompt(akceId) {
  if (confirm("Opravdu chcete tuto položku nenávratně smazat z tabulky?")) {
    runGoogleScript("deleteAkce", { id: akceId }).then(res => {
      if (res.success) { 
        document.getElementById('akceModal').remove(); 
        localStorage.removeItem("bolech_data_cache");
        initApp(); 
      } 
      else alert('Chyba při mazání: ' + res.error);
    });
  }
}

window.maNeulozeneZmeny = false;

function oznacNeulozeneZmeny() {
  window.maNeulozeneZmeny = true;
  const btn = document.getElementById('btnUlozitNoty');
  if(btn) {
    btn.style.background = 'var(--danger)';
    btn.innerHTML = "⚠️ ULOŽIT ZMĚNY (neuloženo)";
  }
}

window.addEventListener('beforeunload', (e) => {
  if (window.maNeulozeneZmeny) {
    e.preventDefault();
    e.returnValue = ''; 
  }
});

function switchTab(t, b) { 
  if (window.maNeulozeneZmeny && t !== 'admin-noty') {
    if (!confirm("⚠️ Ve Správě not máte NEULOŽENÉ ZMĚNY!\n\nOpravdu chcete odejít bez uložení? Změny se nenávratně smažou.")) {
      return; 
    }
    window.maNeulozeneZmeny = false; 
  }

  document.getElementById('tab-events').style.display = t === 'events' ? 'block' : 'none'; 
  document.getElementById('tab-archive').style.display = t === 'archive' ? 'block' : 'none'; 
  document.getElementById('tab-admin-noty').style.display = t === 'admin-noty' ? 'block' : 'none';

  const tabNoty = document.getElementById('tab-sheetmusic');
  if (tabNoty) tabNoty.style.display = t === 'sheetmusic' ? 'block' : 'none'; 
  
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active'); 
    btn.style.color = ''; 
  }); 
  
  if (b) { 
    b.classList.add('active'); 
    if (t === 'events') b.style.color = '#3b82f6';
    else if (t === 'sheetmusic') b.style.color = 'var(--success)';
    else if (t === 'admin-noty') b.style.color = '#06b6d4';
  } 
  
  if (t === 'archive') document.body.classList.add('archive-open');
  else document.body.classList.remove('archive-open');
}

window.stromSlozek = []; 

function vykresliAdminNoty() {
  const cont = document.getElementById('adminNotyContainer');
  if (!cont) return;

  cont.style.padding = "0";
  cont.style.margin = "0"; 
  cont.style.width = "100%";

  try {
    const slozkyMap = {};

    if (!appData.noty || appData.noty.length === 0) {
      cont.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Archiv je zatím prázdný.</p>';
      return;
    }

    appData.noty.forEach(nota => {
      let skladbaText = String(nota.skladba || '').trim();
      if (!skladbaText) return;

      let lastDash = skladbaText.lastIndexOf(' - ');
      let cesta = lastDash !== -1 ? skladbaText.substring(0, lastDash).trim() : 'Základní složka';
      let soubor = lastDash !== -1 ? skladbaText.substring(lastDash + 3).trim() : skladbaText;

      if (!slozkyMap[cesta]) slozkyMap[cesta] = { cesta: cesta, soubory: [], program: '', aktivni: false };

      slozkyMap[cesta].soubory.push({ ...nota, kratkyNazev: soubor });

      let aktivniHodnota = String(nota.aktivni || '').toUpperCase().trim();
      if (aktivniHodnota === 'ANO' || aktivniHodnota === 'TRUE' || aktivniHodnota === '1') {
        slozkyMap[cesta].aktivni = true;
        if (nota.program) slozkyMap[cesta].program = nota.program;
      }
    });

    window.stromSlozek = Object.values(slozkyMap).sort((a, b) => {
      if (a.aktivni && !b.aktivni) return -1;
      if (!a.aktivni && b.aktivni) return 1;
      return a.cesta.localeCompare(b.cesta);
    });

    let html = `
      <style>
        details.folder-inactive:not([open]) .folder-controls {
          display: none !important;
        }
      </style>
    `;

    window.stromSlozek.forEach((s, index) => {
      const zobrazenyNazev = escapeHtml(s.cesta).replace(/\//g, '<span style="color:var(--text-muted); margin:0 4px;">❯</span>');
      const checkBg = s.aktivni ? 'var(--success)' : 'transparent';
      const stavTrida = s.aktivni ? 'folder-active' : 'folder-inactive';

      html += `
        <details class="card ${stavTrida}" style="margin-bottom: 8px; margin-left: 0; margin-right: 0; padding: 0; overflow: hidden; width: 100%; border: 1px solid var(--border);">
          
          <summary style="padding: 10px 14px; cursor: pointer; list-style: none; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold; color: var(--text);">
              <span style="word-break: break-word; line-height: 1.3;">📁 ${zobrazenyNazev} <small style="font-weight:normal; opacity:0.6;">(${s.soubory.length})</small></span>
              <span style="opacity: 0.4; font-size: 14px; padding-left: 8px;">▼</span>
            </div>

            <div class="folder-controls" onclick="event.stopPropagation();" style="display: flex; gap: 8px; align-items: center; width: 100%;">
              
              <input type="text" id="prog_${index}" class="modal-input" placeholder="Název programu..." value="${escapeHtml(s.program)}" style="flex: 1; margin: 0; padding: 10px; font-size: 14px; border-radius: 6px;" oninput="oznacNeulozeneZmeny()">  

              <label style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; min-width: 44px; background: ${checkBg}; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: background 0.2s;" title="Aktivní">
                <input type="checkbox" id="chk_${index}" ${s.aktivni ? 'checked' : ''} style="transform: scale(1.4); margin: 0; cursor: pointer;" 
                       onchange="
                         oznacNeulozeneZmeny();
                         this.parentElement.style.background = this.checked ? 'var(--success)' : 'transparent';
                         const det = this.closest('details');
                         if(this.checked) { det.classList.remove('folder-inactive'); det.classList.add('folder-active'); }
                         else { det.classList.add('folder-inactive'); det.classList.remove('folder-active'); }
                       ">
              </label>

            </div>
          </summary>
          
          <div class="folder-content" style="padding: 12px; display: flex; flex-direction: column; gap: 6px; background: var(--bg);">
            ${s.soubory.map(soub => {
              return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card, transparent); gap: 8px;">
                <a href="${soub.odkaz.replace(/\/view.*/, '/preview')}" target="_blank" style="font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; color: var(--primary); text-decoration: none; font-weight: 600; cursor: pointer;">
                  📄 <span style="text-decoration: underline;">${escapeHtml(soub.kratkyNazev)}</span>
                </a>
                <span style="font-size: 11px; opacity: 0.8; white-space: nowrap; background: var(--border); padding: 4px 6px; border-radius: 4px; color: var(--text);">${escapeHtml(String(soub.sekce||''))}</span>
                <button type="button" onclick="pridatDoFrontyNot('${encodeURIComponent(soub.kratkyNazev)}', '${soub.odkaz}')" style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; min-width: 34px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; color: var(--text-muted); cursor: pointer; transition: background 0.2s;" title="Přidat do fronty k odeslání">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </button>
              </div>
              `;
            }).join('')}
          </div>

        </details>
      `;
    });

    cont.innerHTML = html;

  } catch (error) {
    cont.innerHTML = `<p style="color:var(--danger); padding:16px;">Chyba: ${error.message}</p>`;
  }
}

function ulozitZmenyNot(e) {
  const eventObj = e || window.event;
  if (eventObj && eventObj.preventDefault) {
    eventObj.preventDefault();
  }

  const button = eventObj ? (eventObj.currentTarget || eventObj.target) : null;
  if (button) {
    button.innerText = "⏳ Ukládám změny...";
    button.disabled = true;
  }

  const zmeny = [];

  window.stromSlozek.forEach((s, index) => {
    const chk = document.getElementById('chk_' + index);
    const inputProg = document.getElementById('prog_' + index);

    if (chk && inputProg) {
      const novaAktivni = chk.checked;
      const novyProgram = inputProg.value.trim();

      if (s.aktivni !== novaAktivni || s.program !== novyProgram) {
        const stavText = novaAktivni ? 'ANO' : '';

        s.soubory.forEach(soubor => {
          zmeny.push({
            odkaz: soubor.odkaz,
            aktivni: stavText,
            program: novyProgram
          });
        });
      }
    }
  });

  if (zmeny.length === 0) {
    alert("Nebyly provedeny žádné změny.");
    if (button) {
      button.disabled = false;
      button.innerText = "💾 Uložit všechny změny";
    }
    return;
  }

  runGoogleScript("updateNotyHromadne", { zmeny: zmeny }).then(res => {
    if (button) {
      button.disabled = false;
      button.innerHTML = "💾 Uložit všechny změny";
      button.style.background = "var(--success)";
    }
    if (res.success) {
      window.maNeulozeneZmeny = false;
      alert("Změny v archivu byly úspěšně uloženy.");
      localStorage.removeItem("bolech_data_cache");
      initApp(); 
    } else {
      alert("Chyba při ukládání: " + res.error);
    }
  });
}

function odeslatZadostHosta(e) {
  e.preventDefault();
  const btn = document.getElementById('guestReqBtn');
  const puvodniText = btn.innerText;
  btn.innerText = "Odesílám..."; btn.disabled = true;

  const payload = {
    jmeno: document.getElementById('guestName').value,
    nastroj: document.getElementById('guestInstrument').value,
    email: document.getElementById('guestEmail').value,
    telefon: document.getElementById('guestPhone').value
  };

  runGoogleScript("requestGuestAccount", payload).then(res => {
    btn.innerText = puvodniText; btn.disabled = false;
    if (res.success) {
      alert("Žádost byla úspěšně odeslána vedení! Jakmile ji schválí, přijde vám PIN na e-mail.");
      document.getElementById('guestRequestCard').style.display = 'none'; 
      document.getElementById('loginFormCard').style.display = 'block';
    } else {
      alert("Chyba při odesílání: " + res.error);
    }
  });
}

function openGuestManager() {
  let htmlHoste = "";
  let htmlClenove = "";
  
  if (appData.clenove) {
    appData.clenove.forEach(c => {
      if (c.role.toLowerCase() === 'host') {
         htmlHoste += `<div style="padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 14px;">
                        <strong>${escapeHtml(c.celeJmeno)}</strong> (${escapeHtml(c.sekce)})<br>
                        <span style="color:var(--danger); font-size:12px;">⏳ Platí do: ${escapeHtml(c.platnost)}</span>
                      </div>`;
      } else {
         htmlClenove += `<div style="padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 14px; color:var(--text-muted);">
                        <strong>${escapeHtml(c.celeJmeno)}</strong> (${escapeHtml(c.sekce)})
                      </div>`;
      }
    });
  }
  
  if(!htmlHoste) htmlHoste = "<p style='color:var(--text-muted); font-size:13px;'>Žádní aktivní hosté.</p>";
  if(!htmlClenove) htmlClenove = "<p style='color:var(--text-muted); font-size:13px;'>Žádní členové.</p>";

  let html = `
    <div id="guestModal" class="modal-overlay">
      <div class="modal-box" style="max-height: 90vh; overflow-y: auto; padding-bottom: 30px;">
        <div style="display:flex; align-items:center; margin-bottom: 20px;">
          <button type="button" style="background:transparent; border:none; font-size:16px; color:var(--text); padding:8px 16px 8px 0; margin-right:8px; cursor:pointer; display:flex; align-items:center; gap:6px;" onclick="document.getElementById('guestModal').remove()">
            <span style="font-size:24px; line-height:1;">←</span> Zpět
          </button>
          <h3 style="margin:0; font-size:20px;">👥 Správa hostů</h3>
        </div>
        
        <h4 style="margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom:4px;">Čekající žádosti</h4>
        <div id="pendingRequestsContainer" style="margin-bottom: 24px;">`;
        
        if (!appData.zadosti || appData.zadosti.length === 0) {
          html += `<p style="color:var(--text-muted); font-size:14px;">Žádné nové žádosti.</p>`;
        } else {
          appData.zadosti.forEach(z => {
            html += `
            <div style="border: 1px solid var(--border); padding: 12px; border-radius: 6px; margin-bottom: 12px; background: var(--bg);">
              <strong>${escapeHtml(z.jmeno)}</strong> (${escapeHtml(z.nastroj)})<br>
              <span style="font-size:13px; color:var(--text-muted);">E-mail: ${escapeHtml(z.email)} | Tel: ${escapeHtml(z.telefon)}</span>
              
              <div style="margin-top: 12px; display:flex; gap:8px; align-items:flex-end;">
                <div style="flex:1;">
                  <label style="font-size:12px;">Platnost do:</label>
                  <input type="date" id="exp_${z.rowIdx}" class="modal-input" required>
                </div>
                <button type="button" class="btn" style="background:var(--success); padding:10px 14px;" onclick="schvalitHosta(${z.rowIdx}, '${escapeHtml(z.jmeno)}', '${escapeHtml(z.nastroj)}', '${escapeHtml(z.email)}', this)">Schválit a odeslat PIN</button>
              </div>
            </div>`;
          });
        }

  html += `
        </div>
        
        <h4 style="margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom:4px;">Přímé pozvání hosta</h4>
        <form onsubmit="pridatHostaNaprimo(event)">
          <input type="text" id="dirGuestName" required placeholder="Jméno a Příjmení" class="modal-input" style="margin-bottom: 8px;">
          
          <select id="dirGuestInst" required class="modal-input" style="margin-bottom: 8px;">
            <option value="" disabled selected>Vyberte nástrojovou sekci...</option>
            <option value="1. Housle">1. Housle</option>
            <option value="2. Housle">2. Housle</option>
            <option value="Violy">Violy</option>
            <option value="Violoncella">Violoncella</option>
            <option value="Kontrabasy">Kontrabasy</option>
            <option value="Flétny">Flétny</option>
            <option value="Hoboje">Hoboje</option>
            <option value="Klarinety / Saxofony">Klarinety / Saxofony</option>
            <option value="Fagoty">Fagoty</option>
            <option value="Lesní rohy">Lesní rohy</option>
            <option value="Trubky">Trubky</option>
            <option value="Trombóny a Tuba">Trombóny a Tuba</option>
            <option value="Bicí nástroje">Bicí nástroje</option>
            <option value="Klávesy">Klávesy</option>
            <option value="Kytary">Kytary</option>
            <option value="Zpěv">Zpěv</option>
            <option value="Hosté">Jiný / Ostatní</option>
          </select>

          <input type="email" id="dirGuestEmail" required placeholder="E-mail hosta" class="modal-input" style="margin-bottom: 8px;">
          <label style="font-size:12px; margin-top:8px; display:block;">Platnost účtu do:</label>
          <input type="date" id="dirGuestExp" required class="modal-input" style="margin-bottom: 16px;">
          
          <button type="submit" id="dirGuestBtn" class="btn" style="width:100%; background:var(--primary-light);">Vytvořit hosta a odeslat PIN</button>
        </form>

        <h4 style="margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom:4px;">Aktivní účty (kontrola)</h4>
        
        <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); padding: 10px; border-radius: 6px; background: var(--bg);">
          <h5 style="margin:0 0 8px 0; color:var(--text);">Otevřené účty hostů:</h5>
          ${htmlHoste}
          
          <h5 style="margin:16px 0 8px 0; color:var(--text);">Stálí členové:</h5>
          ${htmlClenove}
        </div>

      </div>
    </div>`;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

function schvalitHosta(rowIdx, jmeno, nastroj, email, btnElem) {
  const expDate = document.getElementById('exp_' + rowIdx).value;
  if (!expDate) { alert("Musíte vybrat datum expirace!"); return; }
  
  btnElem.innerText = "Odesílám..."; btnElem.disabled = true;
  
  runGoogleScript("approveGuest", { zadostRowIdx: rowIdx, jmeno: jmeno, nastroj: nastroj, email: email, expirace: expDate })
  .then(res => {
    if(res.success) {
      alert("Účet byl vytvořen a PIN byl odeslán na e-mail: " + email);
      localStorage.removeItem("bolech_data_cache");
      document.getElementById('guestModal').remove();
      initApp();
    } else { alert("Chyba: " + res.error); btnElem.innerText = "Schválit a odeslat PIN"; btnElem.disabled = false; }
  });
}

function pridatHostaNaprimo(e) {
  e.preventDefault();
  const btn = document.getElementById('dirGuestBtn');
  btn.innerText = "Odesílám..."; btn.disabled = true;
  
  const payload = {
    jmeno: document.getElementById('dirGuestName').value,
    nastroj: document.getElementById('dirGuestInst').value,
    email: document.getElementById('dirGuestEmail').value,
    expirace: document.getElementById('dirGuestExp').value
  };

  runGoogleScript("approveGuest", payload).then(res => {
    if(res.success) {
      alert("Host byl vytvořen a PIN byl odeslán e-mailem!");
      localStorage.removeItem("bolech_data_cache");
      document.getElementById('guestModal').remove();
      initApp();
    } else { alert("Chyba: " + res.error); btn.innerText = "Vytvořit hosta a odeslat PIN"; btn.disabled = false; }
  });
}

function confirmLogout() { 
  if(confirm("Opravdu se chcete odhlásit?")) { localStorage.removeItem('bolech_auth_member'); localStorage.removeItem('bolech_data_cache'); location.reload(); } 
}

window.emailFrontaNot = [];

function pridatDoFrontyNot(kratkyNazev, odkaz) {
  const dekodovanyNazev = decodeURIComponent(kratkyNazev);
  if (!window.emailFrontaNot.find(n => n.odkaz === odkaz)) {
    window.emailFrontaNot.push({ nazev: dekodovanyNazev, odkaz: odkaz });
    vykresliFrontuNot();
  }
}

function odebratZFrontyNot(odkaz) {
  window.emailFrontaNot = window.emailFrontaNot.filter(n => n.odkaz !== odkaz);
  vykresliFrontuNot();
}

function vymazatFrontuNot() {
  window.emailFrontaNot = [];
  vykresliFrontuNot();
}

function odeslatFrontuMailem() {
  if (window.emailFrontaNot.length === 0) return;
  
  let emailTelo = "Dobrý den,\n\nzasílám odkazy pro přímé stažení vybraných not:\n\n";
  window.emailFrontaNot.forEach(n => {
    let downloadOdkaz = n.odkaz.replace(/.*\/d\/([a-zA-Z0-9_-]+).*/, 'https://drive.google.com/uc?export=download&id=$1');
    emailTelo += `- ${n.nazev}:\n  ${downloadOdkaz}\n\n`;
  });
  
  let mailtoOdkaz = `mailto:?subject=${encodeURIComponent("Vybrané noty - TSO Bolech")}&body=${encodeURIComponent(emailTelo)}`;
  window.location.href = mailtoOdkaz;
  vymazatFrontuNot();
}

function vykresliFrontuNot() {
  let widget = document.getElementById('emailFrontaWidget');
  
  if (window.emailFrontaNot.length === 0) {
    if (widget) widget.style.display = 'none';
    return;
  }

  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'emailFrontaWidget';
    widget.style = "position: fixed; bottom: 85px; left: 10px; right: 10px; background: var(--surface); border: 2px solid var(--primary); border-radius: 12px; padding: 12px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);";
    document.body.appendChild(widget);
  }
  
  widget.style.display = 'block';
  
  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <strong style="color:var(--text);">📨 Připraveno k odeslání (${window.emailFrontaNot.length})</strong>
      <button type="button" onclick="vymazatFrontuNot()" style="background:transparent; border:none; color:var(--danger); font-size:12px; padding:4px;">Vymazat frontu</button>
    </div>
    <div style="max-height: 100px; overflow-y:auto; margin-bottom:12px; font-size:13px; color:var(--text-muted);">
      ${window.emailFrontaNot.map(n => `
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; padding-bottom:6px; border-bottom:1px dashed var(--border);">
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85%;">${escapeHtml(n.nazev)}</span>
          <button onclick="odebratZFrontyNot('${n.odkaz}')" style="background:transparent; border:none; color:var(--danger); padding:0 4px; cursor:pointer;">✕</button>
        </div>
      `).join('')}
    </div>
    <button onclick="odeslatFrontuMailem()" class="btn" style="width:100%; background:var(--primary); padding:10px;">Odeslat vše e-mailem</button>
  `;
  widget.innerHTML = html;
}

function zmenitPohledNot(novyNastroj) {
  const jeDirigent = String(user.role || "").trim().toLowerCase() === 'dirigent';
  const nastrojProZobrazeni = (novyNastroj === 'Vlastní part') ? user.section : novyNastroj;
  const simulujDirigenta = (novyNastroj === 'Vlastní part' && jeDirigent);
  vykresliNoty(appData.noty || [], nastrojProZobrazeni, simulujDirigenta);
}