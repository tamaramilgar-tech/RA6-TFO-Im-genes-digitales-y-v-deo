
const APP = JSON.parse(document.getElementById("app-data").textContent);
const PASS_SCORE = 8;
const MAX_ATTEMPTS = 3;
const QUESTIONS_PER_TEST = 10;
const STORAGE_KEY = "ra6_videojuego_progress_v2";

function getTodayCode() {
  const d = new Date();
  return String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0') + String(d.getFullYear()).slice(-2);
}
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const s = raw ? JSON.parse(raw) : {studentName:"", verified:{}, passed:{}, attempts:{}, best:{}};
  s.verified ||= {}; s.passed ||= {}; s.attempts ||= {}; s.best ||= {};
  return s;
}
function saveState(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function phaseIndex(id){ return APP.phases.findIndex(p=>p.id===id); }
function isAccessible(id,s){ const idx=phaseIndex(id); if(idx===0) return true; for(let i=0;i<idx;i++){ if(!s.passed[APP.phases[i].id]) return false; } return true; }
function allPassed(s){ return APP.phases.every(p=>s.passed[p.id]); }

function renderHUD(){
  const s = loadState();
  const completed = APP.phases.filter(p=>s.passed[p.id]).length;
  const total = APP.phases.length;
  document.querySelectorAll("[data-year]").forEach(e=>e.textContent = new Date().getFullYear());
  const progressBars = document.querySelectorAll("[data-progress-fill]");
  progressBars.forEach(bar => bar.style.width = `${Math.round((completed/total)*100)}%`);
  document.querySelectorAll("[data-progress-text]").forEach(t => t.textContent = `${completed}/${total} fases superadas`);
  const input = document.getElementById("student-name");
  if (input) input.value = s.studentName || "";
  const badge = document.getElementById("student-badge");
  if (badge) badge.textContent = s.studentName ? `Jugador: ${s.studentName}` : "Jugador sin registrar";
  document.querySelectorAll("[data-phase-card]").forEach(card=>{
    const id = card.dataset.phaseCard;
    const st = card.querySelector("[data-status]");
    const accessible = isAccessible(id,s), passed = !!s.passed[id];
    if(st){
      st.textContent = passed ? "Superada" : accessible ? "Disponible" : "Bloqueada";
      st.className = "phase-status " + (passed ? "ok" : accessible ? "open" : "lock");
    }
    card.classList.toggle("locked", !accessible);
  });
  document.querySelectorAll("[data-cert-link]").forEach(link=>{
    if(!allPassed(s)){ link.classList.add("locked-link"); link.onclick=(e)=>e.preventDefault(); } else { link.classList.remove("locked-link"); link.onclick=null; }
  });
}
function saveStudentName(){
  const s = loadState();
  const input = document.getElementById("student-name");
  s.studentName = input ? input.value.trim() : "";
  saveState(s);
  renderHUD();
  const msg = document.getElementById("student-msg");
  if(msg) msg.textContent = s.studentName ? "Nombre guardado correctamente." : "Escribe un nombre para guardarlo.";
}
function resetProgress(){
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}
function buildQuestionSet(id){
  return shuffle(APP.questions[id]).slice(0, QUESTIONS_PER_TEST).map(q=>{
    const opts = q[1].map((txt,i)=>({txt, original:i}));
    const sh = shuffle(opts);
    return {q:q[0], options:sh.map(x=>x.txt), answer:sh.findIndex(x=>x.original===q[2])};
  });
}
function nextPhaseButton(phaseId){
  const idx = phaseIndex(phaseId);
  if(idx === APP.phases.length - 1) return `<a class="btn pixel-btn" href="certificado.html">Ir al certificado final</a>`;
  return `<a class="btn pixel-btn" href="${APP.phases[idx+1].file}">Desbloquear siguiente fase</a>`;
}
function renderVerification(id){
  const box = document.getElementById("verification-box"); if(!box) return;
  const s = loadState(); const done = !!s.verified[id];
  box.innerHTML = `<section class="panel game-panel"><h2>Control del docente</h2><p>Cuando hayas subido la práctica a EVAGD, introduce el código de validación facilitado por el profesorado para activar el test de esta fase.</p><div class="verify-row"><input type="password" id="verify-input" placeholder="Código de verificación" ${done ? "disabled" : ""}><button class="btn pixel-btn" id="verify-btn" ${done ? "disabled" : ""}>${done ? "Fase validada" : "Validar práctica"}</button></div><p class="mini" id="verify-msg">${done ? "La práctica ya está validada. Puedes realizar el test." : ""}</p></section>`;
  if(!done){
    document.getElementById("verify-btn").onclick = ()=>{
      const val = document.getElementById("verify-input").value.trim();
      const msg = document.getElementById("verify-msg");
      if(val === getTodayCode()){
        const st = loadState();
        st.verified[id] = true;
        saveState(st);
        renderVerification(id);
        renderTest(id);
        msg.textContent = "Código correcto. Test desbloqueado.";
      } else {
        msg.textContent = "Código incorrecto. Revisa el código facilitado por el profesorado.";
      }
    };
  }
}
function renderTest(id){
  const box = document.getElementById("test-box"); if(!box) return;
  const s = loadState();
  if(!s.verified[id]){
    box.innerHTML = `<section class="panel game-panel"><h2>Test bloqueado</h2><p>El test se activa después de la validación del docente.</p></section>`;
    return;
  }
  if(s.passed[id]){
    box.innerHTML = `<section class="panel game-panel"><h2>Fase superada</h2><p>Has alcanzado el 80% o más. Ya puedes continuar la aventura.</p>${nextPhaseButton(id)}</section>`;
    return;
  }
  const used = (s.attempts[id] || []).length;
  if(used >= MAX_ATTEMPTS){
    box.innerHTML = `<section class="panel game-panel"><h2>Intentos agotados</h2><p>Has usado los 3 intentos. Revisa la autocorrección final y consulta con el profesorado.</p></section>`;
    return;
  }
  const questions = buildQuestionSet(id);
  box.innerHTML = `<section class="panel game-panel"><div class="test-head"><div><h2>Desafío de fase</h2><p>Necesitas 8 de 10 para superar esta misión. Tienes hasta 3 intentos.</p></div><span class="attempt-pill">Intento ${used+1} de ${MAX_ATTEMPTS}</span></div><form id="phase-test"></form></section>`;
  const form = document.getElementById("phase-test");
  questions.forEach((q,i)=>{
    const fs = document.createElement("fieldset");
    fs.className = "qbox";
    fs.innerHTML = `<legend>${i+1}. ${q.q}</legend>`;
    q.options.forEach((opt,j)=>{
      const label = document.createElement("label");
      label.className = "opt";
      label.innerHTML = `<input type="radio" name="q${i}" value="${j}" required><span>${String.fromCharCode(97+j)}) ${opt}</span>`;
      fs.appendChild(label);
    });
    form.appendChild(fs);
  });
  const actions = document.createElement("div");
  actions.className = "actions";
  actions.innerHTML = `<button class="btn pixel-btn" type="submit">Enviar intento</button>`;
  form.appendChild(actions);
  form.onsubmit = (e)=>{
    e.preventDefault();
    let score = 0;
    const answers = [];
    questions.forEach((q,i)=>{
      const sel = form.querySelector(`input[name="q${i}"]:checked`);
      const val = Number(sel.value);
      answers.push(val);
      if(val === q.answer) score++;
    });
    const percent = Math.round(score * 10);
    const st = loadState();
    st.attempts[id] ||= [];
    st.attempts[id].push({score, percent, answers, questions});
    st.best[id] = Math.max(st.best[id] || 0, score);
    if(score >= PASS_SCORE) st.passed[id] = true;
    saveState(st);
    renderHUD();
    renderTest(id);
    renderSummary(id);
  };
}
function renderSummary(id){
  const box = document.getElementById("summary-box"); if(!box) return;
  const s = loadState();
  const attempts = s.attempts[id] || [];
  if(!attempts.length){
    box.innerHTML = `<section class="panel game-panel"><h2>Panel de progreso</h2><p>Aún no hay intentos registrados en esta fase.</p></section>`;
    return;
  }
  let html = `<section class="panel game-panel"><h2>Panel de progreso</h2><div class="attempt-grid">`;
  attempts.forEach((a,i)=>{
    html += `<article class="attempt-card"><h3>Intento ${i+1}</h3><p>Puntuación: <strong>${a.score}/10</strong></p><p>Porcentaje: <strong>${a.percent}%</strong></p></article>`;
  });
  html += `</div>`;
  const remaining = MAX_ATTEMPTS - attempts.length;
  const last = attempts[attempts.length-1];
  if(s.passed[id]){
    html += `<div class="banner success">¡Misión completada! Has superado la fase con ${last.percent}% de acierto.</div>${nextPhaseButton(id)}`;
  } else if(remaining > 0){
    html += `<div class="banner warn">Todavía no alcanzas el 80%. Te quedan ${remaining} intento(s). Puedes volver a intentarlo.</div>`;
  } else {
    html += `<div class="banner fail">No se ha superado la fase tras 3 intentos. Se muestra la autocorrección final.</div>`;
    attempts.forEach((a,idx)=>{
      html += `<div class="correction"><h3>Autocorrección del intento ${idx+1}</h3>`;
      a.questions.forEach((q,i)=>{
        const ok = a.answers[i] === q.answer;
        html += `<div class="corr-item ${ok ? "ok":"ko"}"><p><strong>${i+1}. ${q.q}</strong></p><p>Tu respuesta: ${q.options[a.answers[i]] || "Sin responder"}</p><p>Correcta: <strong>${q.options[q.answer]}</strong></p></div>`;
      });
      html += `</div>`;
    });
  }
  box.innerHTML = html + `</section>`;
}
function renderPhasePage(){
  const id = document.body.dataset.phase;
  if(!id) return;
  const s = loadState();
  if(!isAccessible(id,s)){
    document.getElementById("phase-shell").innerHTML = `<section class="panel game-panel"><h2>Zona bloqueada</h2><p>Debes superar la fase anterior para continuar la aventura.</p><a class="btn pixel-btn" href="index.html">Volver al mapa</a></section>`;
    return;
  }
  renderVerification(id);
  renderTest(id);
  renderSummary(id);
}
function renderCertificate(){
  if(!document.body.classList.contains("certificate-page")) return;
  const s = loadState();
  const gate = document.getElementById("cert-gate");
  const panel = document.getElementById("cert-panel");
  if(!allPassed(s)){
    gate.innerHTML = `<section class="panel game-panel"><h2>Certificado bloqueado</h2><p>Debes completar las seis misiones para obtener el certificado final.</p><a class="btn pixel-btn" href="index.html">Volver al mapa</a></section>`;
    panel.innerHTML = "";
    return;
  }
  gate.innerHTML = `<section class="panel game-panel"><h2>Certificado final disponible</h2><p>Has completado toda la aventura multimedia. Ya puedes generar tu certificado.</p></section>`;
  const rows = APP.phases.map(p=>{
    const best = s.best[p.id] || 0;
    const pct = best * 10;
    return `<tr><td>${p.title}</td><td>${best}/10</td><td>${pct}%</td><td>${s.passed[p.id] ? "Superada" : "No superada"}</td></tr>`;
  }).join("");
  panel.innerHTML = `<section class="panel game-panel"><div class="cert-sheet"><p class="cert-kicker">Certificado de aprovechamiento</p><h1>RA6 · Aventura multimedia</h1><p>Se certifica que</p><h2>${s.studentName || "Alumno no registrado"}</h2><p>ha completado el itinerario por fases, superando las misiones prácticas y sus pruebas de verificación.</p><table class="cert-table"><thead><tr><th>Fase</th><th>Mejor resultado</th><th>Valoración</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table><p class="mini">Fecha de emisión: ${new Date().toLocaleDateString("es-ES")}</p></div><div class="actions"><button class="btn pixel-btn" onclick="window.print()">Imprimir / Guardar en PDF</button></div></section>`;
}
document.addEventListener("DOMContentLoaded", ()=>{
  renderHUD();
  const save = document.getElementById("save-student");
  if(save) save.onclick = saveStudentName;
  const reset = document.getElementById("reset-progress");
  if(reset) reset.onclick = resetProgress;
  renderPhasePage();
  renderCertificate();
});
