// ============================================================
//  INTELLECTAQUIZ — Core Application
//  Kabert Studio - LMKE
// ============================================================

// ╔══════════════════════════════════════════════════════════╗
// ║  ADMIN PANEL TOGGLE                                     ║
// ║  Para OCULTAR el panel administrador:                   ║
// ║    Cambia: ENABLE_ADMIN_PANEL = true  →  false          ║
// ║  Esto ocultará el acceso admin sin romper la app.       ║
// ╚══════════════════════════════════════════════════════════╝
const ENABLE_ADMIN_PANEL = true;

// ── Firebase SDK (modular via CDN compat) ──────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, onSnapshot, query, where,
  orderBy, serverTimestamp, writeBatch, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNH4oSr4CeqMXA3atmw71I2hFQO1SvDG0",
  authDomain: "intellectaquiz.firebaseapp.com",
  projectId: "intellectaquiz",
  storageBucket: "intellectaquiz.firebasestorage.app",
  messagingSenderId: "263197843301",
  appId: "1:263197843301:web:004d3e9da9bf09b2a44b8c"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ── Global State ───────────────────────────────────────────
let currentUser = null;
let userProfile = null;
let isAdmin = false;
let activeExam = null;
let examUnsubscribe = null;
let timerInterval = null;
let currentQuestionIndex = 0;
let userAnswers = {};
let examTimerSeconds = 0;
let studentAnswers = {};
let questionsData = [];
let connectedStudentsUnsub = null;
let examGlobalTimer = 0;
let globalTimerInterval = null;
let tabSwitchCount = 0;

// ── Page Router ────────────────────────────────────────────
const pages = {};
document.querySelectorAll('.page').forEach(p => pages[p.id] = p);

function showPage(id) {
  Object.values(pages).forEach(p => p.classList.remove('active'));
  const page = pages[id];
  if (page) {
    page.classList.add('active');
    page.classList.add('fade-in');
    setTimeout(() => page.classList.remove('fade-in'), 400);
  }
  updateNavActive(id);
  updateBottomNav(id);
}

function updateNavActive(pageId) {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === pageId);
  });
}
function updateBottomNav(pageId) {
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === pageId);
  });
}

// ── Toast System ───────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 350);
  }, duration);
}

// ── Modal Helper ───────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay').id));
});

// ── Auth State Listener ────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  document.getElementById('loading-screen').classList.add('fade-out');
  setTimeout(() => document.getElementById('loading-screen').style.display = 'none', 600);

  if (user) {
    currentUser = user;
    await loadUserProfile(user.uid);
    checkActiveExam();
  } else {
    currentUser = null;
    userProfile = null;
    isAdmin = false;
    showPage('page-auth');
  }
});

// ── Load User Profile ──────────────────────────────────────
async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) {
    userProfile = snap.data();
    isAdmin = userProfile.role === 'admin';
    renderNavbar();
    if (isAdmin) {
      renderAdminDashboard();
      showPage('page-admin');
    } else {
      renderStudentDashboard();
      showPage('page-student');
    }
  } else {
    showPage('page-complete-profile');
  }
}

// ── Navbar Render ──────────────────────────────────────────
function renderNavbar() {
  const nav = document.getElementById('main-navbar');
  nav.style.display = 'flex';
  const initials = (userProfile?.name || currentUser?.email || '?').substring(0, 2).toUpperCase();
  document.getElementById('user-avatar-initials').textContent = initials;
  document.getElementById('user-display-name').textContent = userProfile?.name?.split(' ')[0] || 'Usuario';
  document.getElementById('admin-nav-link').style.display = ENABLE_ADMIN_PANEL && isAdmin ? 'flex' : 'none';
}

// ── Auth: Login ────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { toast('Completa todos los campos', 'error'); return; }
  setLoading('btn-login', true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    toast('¡Bienvenido de vuelta!', 'success');
  } catch (e) {
    toast(getAuthError(e.code), 'error');
  } finally {
    setLoading('btn-login', false);
  }
});

// ── Auth: Register ─────────────────────────────────────────
document.getElementById('btn-register').addEventListener('click', async () => {
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  if (!email || !pass) { toast('Completa todos los campos', 'error'); return; }
  if (pass !== pass2) { toast('Las contraseñas no coinciden', 'error'); return; }
  if (pass.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
  setLoading('btn-register', true);
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    toast('Cuenta creada. Completa tu perfil', 'success');
  } catch (e) {
    toast(getAuthError(e.code), 'error');
  } finally {
    setLoading('btn-register', false);
  }
});

// ── Complete Profile ───────────────────────────────────────
document.getElementById('btn-complete-profile').addEventListener('click', async () => {
  const name  = document.getElementById('profile-name').value.trim();
  const nivel = document.getElementById('profile-nivel').value;
  const curso = document.getElementById('profile-curso').value.trim();
  if (!name || !nivel || !curso) { toast('Completa todos los campos', 'error'); return; }
  setLoading('btn-complete-profile', true);
  try {
    const userData = {
      name, nivel, curso,
      email: currentUser.email,
      uid: currentUser.uid,
      role: 'student',
      createdAt: serverTimestamp(),
      exams: []
    };
    await setDoc(doc(db, 'users', currentUser.uid), userData);
    userProfile = userData;
    isAdmin = false;
    renderNavbar();
    renderStudentDashboard();
    showPage('page-student');
    toast('¡Perfil completado!', 'success');
  } catch (e) {
    toast('Error al guardar perfil: ' + e.message, 'error');
  } finally {
    setLoading('btn-complete-profile', false);
  }
});

// ── Logout ─────────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', async () => {
  stopAllListeners();
  await signOut(auth);
  document.getElementById('main-navbar').style.display = 'none';
  toast('Sesión cerrada', 'info');
});

// ── Auth Tabs ─────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
    document.getElementById('form-' + tab.dataset.tab).classList.remove('hidden');
  });
});

function getAuthError(code) {
  const map = {
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/email-already-in-use': 'El email ya está registrado',
    'auth/invalid-email': 'Email inválido',
    'auth/too-many-requests': 'Demasiados intentos, espera un momento',
    'auth/invalid-credential': 'Credenciales incorrectas',
  };
  return map[code] || 'Error de autenticación';
}

function setLoading(btnId, state) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = state;
  btn.style.opacity = state ? '.6' : '1';
}

// ── Stop All Listeners ─────────────────────────────────────
function stopAllListeners() {
  if (examUnsubscribe) { examUnsubscribe(); examUnsubscribe = null; }
  if (connectedStudentsUnsub) { connectedStudentsUnsub(); connectedStudentsUnsub = null; }
  clearInterval(timerInterval);
  clearInterval(globalTimerInterval);
}

// ── CHECK ACTIVE EXAM ──────────────────────────────────────
async function checkActiveExam() {
  try {
    const examSnap = await getDoc(doc(db, 'config', 'activeExam'));
    if (examSnap.exists() && examSnap.data().active) {
      activeExam = examSnap.data();
      const userNivel = userProfile?.nivel;
      const examNivel = activeExam.nivel;
      if (!isAdmin && (examNivel === 'all' || examNivel === userNivel)) {
        // Check if student already has session
        const sessionSnap = await getDoc(doc(db, 'sessions', currentUser.uid));
        if (sessionSnap.exists()) {
          const sess = sessionSnap.data();
          userAnswers = sess.answers || {};
          currentQuestionIndex = sess.lastQuestion || 0;
          if (!sess.finished) {
            await loadExamForStudent();
            return;
          }
        } else {
          await loadExamForStudent();
          return;
        }
      }
    }
  } catch(e) {}
  if (isAdmin) {
    renderAdminDashboard();
    showPage('page-admin');
  } else {
    renderStudentDashboard();
    showPage('page-student');
  }
}

// ══════════════════════════════════════════════════════════
//  STUDENT SECTION
// ══════════════════════════════════════════════════════════

function renderStudentDashboard() {
  const el = document.getElementById('student-welcome');
  if (!el || !userProfile) return;
  el.innerHTML = `
    <h2 class="glow-text">¡Hola, ${userProfile.name?.split(' ')[0]}! 👋</h2>
    <p class="text-dim mt-1">${userProfile.nivel} · ${userProfile.curso}</p>
  `;
  loadStudentHistory();
  listenForActiveExam();
}

function loadStudentHistory() {
  const container = document.getElementById('student-history-list');
  if (!container) return;
  getDocs(query(
    collection(db, 'results'),
    where('uid', '==', currentUser.uid),
    orderBy('completedAt', 'desc')
  )).then(snap => {
    if (snap.empty) {
      container.innerHTML = `<div class="text-center text-muted mt-5"><div style="font-size:3rem">📋</div><p class="mt-3">Sin evaluaciones aún</p></div>`;
      return;
    }
    container.innerHTML = '';
    snap.forEach(d => {
      const r = d.data();
      const pct = Math.round((r.correct / r.total) * 100);
      const date = r.completedAt?.toDate ? r.completedAt.toDate().toLocaleDateString('es-BO') : '-';
      container.innerHTML += `
        <div class="student-row">
          <div class="stat-icon" style="background:rgba(108,99,255,.15)">📝</div>
          <div class="student-info">
            <div class="student-name">${r.examTitle || 'Evaluación'}</div>
            <div class="student-meta">${date} · ${r.nivel || ''}</div>
          </div>
          <div class="flex gap-2 items-center">
            <span class="badge ${pct>=70?'badge-green':pct>=50?'badge-yellow':'badge-red'}">${pct}%</span>
            ${r.resultsVisible ? `<button class="btn btn-sm btn-outline" onclick="showStudentResult('${d.id}')">Ver</button>` : '<span class="badge badge-violet">Pendiente</span>'}
          </div>
        </div>
      `;
    });
    // Update stats
    updateStudentStats(snap);
  }).catch(() => {});
}

async function updateStudentStats(snap) {
  const results = snap.docs.map(d => d.data());
  const total = results.length;
  const avgPct = total > 0 ? Math.round(results.reduce((a, r) => a + (r.correct / r.total) * 100, 0) / total) : 0;
  document.getElementById('stat-total-exams').textContent = total;
  document.getElementById('stat-avg-score').textContent = avgPct + '%';
}

// ── Listen for Active Exam (Student) ──────────────────────
function listenForActiveExam() {
  if (examUnsubscribe) examUnsubscribe();
  examUnsubscribe = onSnapshot(doc(db, 'config', 'activeExam'), async (snap) => {
    if (snap.exists() && snap.data().active) {
      activeExam = snap.data();
      const examNivel = activeExam.nivel;
      if (examNivel === 'all' || examNivel === userProfile?.nivel) {
        // Show waiting/active banner
        document.getElementById('exam-banner').classList.remove('hidden');
        document.getElementById('exam-banner-title').textContent = activeExam.title || 'Evaluación Activa';
        document.getElementById('exam-banner-nivel').textContent = activeExam.nivel || '';
        // Load exam immediately
        await loadExamForStudent();
      }
    } else {
      activeExam = null;
      document.getElementById('exam-banner').classList.add('hidden');
      exitExamMode();
    }
    // Listen for results unlock
    if (snap.exists() && snap.data().resultsVisible) {
      checkAndShowResults();
    }
  });
}

async function loadExamForStudent() {
  if (!activeExam || !activeExam.examId) return;
  const examDoc = await getDoc(doc(db, 'exams', activeExam.examId));
  if (!examDoc.exists()) return;
  questionsData = examDoc.data().questions || [];
  if (questionsData.length === 0) return;
  enterExamMode();
}

// ── EXAM MODE ──────────────────────────────────────────────
function enterExamMode() {
  const overlay = document.getElementById('exam-mode-overlay');
  overlay.classList.add('active');
  document.getElementById('main-navbar').style.display = 'none';
  // Restore progress
  getDoc(doc(db, 'sessions', currentUser.uid)).then(snap => {
    if (snap.exists() && !snap.data().finished) {
      userAnswers = snap.data().answers || {};
      currentQuestionIndex = snap.data().lastQuestion || 0;
    }
    renderExamQuestion();
    startExamTimer();
    setupAntiCheat();
  }).catch(() => {
    userAnswers = {};
    currentQuestionIndex = 0;
    renderExamQuestion();
    startExamTimer();
  });
}

function exitExamMode() {
  const overlay = document.getElementById('exam-mode-overlay');
  overlay.classList.remove('active');
  document.getElementById('main-navbar').style.display = 'flex';
  clearInterval(timerInterval);
  if (!isAdmin) renderStudentDashboard();
}

function renderExamQuestion() {
  const q = questionsData[currentQuestionIndex];
  if (!q) return;
  const total = questionsData.length;
  const answered = Object.keys(userAnswers).length;
  document.getElementById('exam-question-counter').textContent = `Pregunta ${currentQuestionIndex + 1} de ${total}`;
  document.getElementById('exam-progress-fill').style.width = `${((currentQuestionIndex) / total) * 100}%`;
  document.getElementById('exam-answered-count').textContent = `${answered}/${total} respondidas`;
  const letters = ['A', 'B', 'C', 'D'];
  document.getElementById('exam-question-text').textContent = q.question;
  const answersHTML = q.options.map((opt, i) => `
    <button class="answer-btn ${userAnswers[currentQuestionIndex] === i ? 'selected' : ''}"
            onclick="selectAnswer(${i})" ${userAnswers[currentQuestionIndex] !== undefined ? 'disabled' : ''}>
      <span class="answer-letter">${letters[i]}</span>
      <span>${opt}</span>
    </button>
  `).join('');
  document.getElementById('exam-answers-grid').innerHTML = answersHTML;
  document.getElementById('btn-prev-q').disabled = currentQuestionIndex === 0;
  document.getElementById('btn-next-q').textContent = currentQuestionIndex === total - 1 ? '✅ Finalizar' : 'Siguiente →';
}

window.selectAnswer = async function(optionIndex) {
  userAnswers[currentQuestionIndex] = optionIndex;
  renderExamQuestion();
  // Auto-advance
  if (currentQuestionIndex < questionsData.length - 1) {
    setTimeout(() => { currentQuestionIndex++; renderExamQuestion(); }, 600);
  }
  // Save to Firebase
  try {
    await setDoc(doc(db, 'sessions', currentUser.uid), {
      uid: currentUser.uid,
      name: userProfile?.name,
      nivel: userProfile?.nivel,
      curso: userProfile?.curso,
      answers: userAnswers,
      lastQuestion: currentQuestionIndex,
      finished: false,
      examId: activeExam?.examId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch(e) {}
};

document.getElementById('btn-next-q').addEventListener('click', () => {
  if (currentQuestionIndex < questionsData.length - 1) {
    currentQuestionIndex++;
    renderExamQuestion();
  } else {
    confirmSubmitExam();
  }
});

document.getElementById('btn-prev-q').addEventListener('click', () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderExamQuestion();
  }
});

function confirmSubmitExam() {
  const answered = Object.keys(userAnswers).length;
  const total = questionsData.length;
  if (answered < total) {
    if (!confirm(`Tienes ${total - answered} preguntas sin responder. ¿Finalizar de todas formas?`)) return;
  }
  submitExam();
}

async function submitExam() {
  if (!activeExam || !questionsData.length) return;
  let correct = 0;
  questionsData.forEach((q, i) => {
    if (userAnswers[i] === q.correctIndex) correct++;
  });
  const total = questionsData.length;
  const pct = Math.round((correct / total) * 100);
  try {
    // Save result
    const resultData = {
      uid: currentUser.uid,
      name: userProfile?.name,
      email: currentUser.email,
      nivel: userProfile?.nivel,
      curso: userProfile?.curso,
      examId: activeExam.examId,
      examTitle: activeExam.title,
      answers: userAnswers,
      correct, total,
      percentage: pct,
      completedAt: serverTimestamp(),
      resultsVisible: false
    };
    const resultRef = await addDoc(collection(db, 'results'), resultData);
    // Mark session as finished
    await setDoc(doc(db, 'sessions', currentUser.uid), {
      finished: true, resultId: resultRef.id, correct, total, percentage: pct, updatedAt: serverTimestamp()
    }, { merge: true });
    // Update student progress in admin view
    await setDoc(doc(db, 'examProgress', currentUser.uid), {
      uid: currentUser.uid,
      name: userProfile?.name,
      finished: true,
      correct, total, percentage: pct,
      examId: activeExam.examId,
      nivel: userProfile?.nivel,
      curso: userProfile?.curso,
      tabSwitches: tabSwitchCount,
      updatedAt: serverTimestamp()
    }, { merge: true });
    showExamWaiting(correct, total, pct);
  } catch(e) {
    toast('Error al enviar: ' + e.message, 'error');
  }
}

function showExamWaiting(correct, total, pct) {
  document.getElementById('exam-content').innerHTML = `
    <div class="text-center flex-col items-center gap-5" style="max-width:500px;margin:0 auto">
      <div class="waiting-animation">✅</div>
      <div>
        <h2 class="glow-text" style="font-size:1.8rem">¡Evaluación enviada!</h2>
        <p class="text-dim mt-2">Espera a que el administrador muestre los resultados</p>
      </div>
      <div class="card" style="width:100%">
        <div class="grid-3">
          <div class="result-stat"><div class="value text-green">${correct}</div><div class="label">Correctas</div></div>
          <div class="result-stat"><div class="value text-red">${total - correct}</div><div class="label">Incorrectas</div></div>
          <div class="result-stat"><div class="value text-violet">${pct}%</div><div class="label">Puntaje</div></div>
        </div>
      </div>
      <div class="alert alert-info">
        <span>🔒</span> Los resultados detallados estarán disponibles cuando el administrador los libere.
      </div>
    </div>
  `;
}

function startExamTimer() {
  clearInterval(timerInterval);
  if (!activeExam?.durationMinutes) return;
  examTimerSeconds = activeExam.durationMinutes * 60;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    examTimerSeconds--;
    updateTimerDisplay();
    if (examTimerSeconds <= 0) { clearInterval(timerInterval); submitExam(); }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(examTimerSeconds / 60);
  const s = examTimerSeconds % 60;
  const el = document.getElementById('exam-timer');
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  el.className = 'timer-display';
  if (examTimerSeconds <= 60) el.classList.add('danger');
  else if (examTimerSeconds <= 300) el.classList.add('warning');
}

// ── Anti-cheat ─────────────────────────────────────────────
function setupAntiCheat() {
  tabSwitchCount = 0;
  document.addEventListener('visibilitychange', onTabSwitch);
}
function onTabSwitch() {
  if (document.hidden) {
    tabSwitchCount++;
    if (tabSwitchCount <= 3) toast(`⚠️ Advertencia ${tabSwitchCount}/3: No abandones la evaluación`, 'warning', 4000);
    setDoc(doc(db, 'examProgress', currentUser.uid), { tabSwitches: tabSwitchCount }, { merge: true }).catch(() => {});
  }
}

// ── Results unlock listener ────────────────────────────────
async function checkAndShowResults() {
  const sessionSnap = await getDoc(doc(db, 'sessions', currentUser.uid));
  if (!sessionSnap.exists() || !sessionSnap.data().resultId) return;
  const resultId = sessionSnap.data().resultId;
  await updateDoc(doc(db, 'results', resultId), { resultsVisible: true });
  showStudentResult(resultId);
}

window.showStudentResult = async function(resultId) {
  const snap = await getDoc(doc(db, 'results', resultId));
  if (!snap.exists()) return;
  const r = snap.data();
  const pct = r.percentage || Math.round((r.correct / r.total) * 100);
  document.getElementById('result-modal-content').innerHTML = `
    <div class="text-center mb-6">
      <div style="font-size:4rem;margin-bottom:12px">${pct>=70?'🏆':pct>=50?'👍':'📚'}</div>
      <h2 class="glow-text" style="font-size:2rem">${pct}%</h2>
      <p class="text-dim">${r.examTitle || 'Evaluación'}</p>
    </div>
    <div class="grid-3 mb-5">
      <div class="result-stat"><div class="value text-green">${r.correct}</div><div class="label">Correctas</div></div>
      <div class="result-stat"><div class="value text-red">${r.total - r.correct}</div><div class="label">Incorrectas</div></div>
      <div class="result-stat"><div class="value text-violet">${r.total}</div><div class="label">Total</div></div>
    </div>
    <button class="btn btn-primary btn-block" onclick="generatePDF('${resultId}')">📄 Descargar PDF</button>
  `;
  openModal('result-modal');
};

// ── PDF Generator ──────────────────────────────────────────
window.generatePDF = async function(resultId) {
  const snap = await getDoc(doc(db, 'results', resultId));
  if (!snap.exists()) return;
  const r = snap.data();
  const pct = r.percentage || Math.round((r.correct / r.total) * 100);
  const date = r.completedAt?.toDate ? r.completedAt.toDate().toLocaleDateString('es-BO') : new Date().toLocaleDateString('es-BO');
  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Reporte - ${r.name}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;background:#f8faff;color:#1a1a2e;margin:0;padding:40px}
      .header{background:linear-gradient(135deg,#6c63ff,#4fc3f7);color:#fff;padding:32px;border-radius:16px;margin-bottom:28px;text-align:center}
      .logo{font-size:2.5rem;margin-bottom:8px}
      h1{margin:0;font-size:1.8rem;letter-spacing:-.02em}
      .subtitle{opacity:.8;font-size:.9rem;margin-top:4px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
      .info-card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
      .info-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:#888;font-weight:700;margin-bottom:4px}
      .info-value{font-size:1rem;font-weight:600;color:#1a1a2e}
      .score-card{background:linear-gradient(135deg,#6c63ff15,#4fc3f715);border:2px solid #6c63ff30;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px}
      .score-num{font-size:4rem;font-weight:900;color:#6c63ff;line-height:1}
      .score-label{font-size:.9rem;color:#555;margin-top:6px}
      .stats{display:flex;gap:16px;justify-content:center;margin-top:20px}
      .stat{padding:12px 20px;border-radius:10px;font-weight:700;font-size:1.1rem;text-align:center}
      .stat-label{font-size:.72rem;opacity:.7;font-weight:500;margin-top:2px}
      .correct{background:#dcfce7;color:#16a34a}
      .wrong{background:#fee2e2;color:#dc2626}
      footer{text-align:center;margin-top:40px;color:#aaa;font-size:.78rem;border-top:1px solid #e5e7eb;padding-top:20px}
    </style></head><body>
    <div class="header">
      <div class="logo">⭐</div>
      <h1>IntellectaQuiz</h1>
      <div class="subtitle">Reporte de Evaluación Académica</div>
    </div>
    <div class="info-grid">
      <div class="info-card"><div class="info-label">Estudiante</div><div class="info-value">${r.name}</div></div>
      <div class="info-card"><div class="info-label">Nivel / Curso</div><div class="info-value">${r.nivel} · ${r.curso}</div></div>
      <div class="info-card"><div class="info-label">Evaluación</div><div class="info-value">${r.examTitle || 'Evaluación'}</div></div>
      <div class="info-card"><div class="info-label">Fecha</div><div class="info-value">${date}</div></div>
    </div>
    <div class="score-card">
      <div class="score-num">${pct}%</div>
      <div class="score-label">Puntaje Final</div>
      <div class="stats">
        <div class="stat correct"><div>${r.correct}</div><div class="stat-label">Correctas</div></div>
        <div class="stat wrong"><div>${r.total - r.correct}</div><div class="stat-label">Incorrectas</div></div>
        <div class="stat" style="background:#eff6ff;color:#1d4ed8"><div>${r.total}</div><div class="stat-label">Total</div></div>
      </div>
    </div>
    <footer>Reporte generado por IntellectaQuiz · Kabert Studio - LMKE · ${new Date().toLocaleString('es-BO')}</footer>
    <script>window.print();<\/script>
    </body></html>
  `);
  w.document.close();
};

// ══════════════════════════════════════════════════════════
//  ADMIN SECTION
// ══════════════════════════════════════════════════════════

function renderAdminDashboard() {
  listenToExamProgress();
  loadExamsList();
}

// ── Listen to progress ─────────────────────────────────────
function listenToExamProgress() {
  if (connectedStudentsUnsub) connectedStudentsUnsub();
  connectedStudentsUnsub = onSnapshot(collection(db, 'examProgress'), (snap) => {
    const students = snap.docs.map(d => d.data());
    renderAdminLiveBoard(students);
  });
}

function renderAdminLiveBoard(students) {
  const container = document.getElementById('admin-live-board');
  if (!container) return;
  const finished = students.filter(s => s.finished).length;
  const connected = students.length;
  document.getElementById('admin-stat-connected').textContent = connected;
  document.getElementById('admin-stat-finished').textContent = finished;
  const avgPct = connected > 0 ? Math.round(students.filter(s => s.finished).reduce((a, s) => a + (s.percentage || 0), 0) / (finished || 1)) : 0;
  document.getElementById('admin-stat-avg').textContent = avgPct + '%';
  if (!students.length) {
    container.innerHTML = `<div class="text-center text-muted mt-5"><div style="font-size:2.5rem">👥</div><p class="mt-2">Sin estudiantes conectados</p></div>`;
    return;
  }
  container.innerHTML = students.map(s => {
    const pct = s.percentage || 0;
    const progress = s.finished ? 100 : Math.round(((Object.keys(s.answers || {}).length) / (s.total || 1)) * 100);
    return `
      <div class="student-row">
        <div class="avatar" style="width:36px;height:36px;min-width:36px;font-size:.85rem">${(s.name||'?').substring(0,2).toUpperCase()}</div>
        <div class="student-info">
          <div class="student-name">${s.name || 'Estudiante'}</div>
          <div class="student-meta">${s.nivel || ''} · ${s.curso || ''} ${s.tabSwitches > 0 ? `· ⚠️ ${s.tabSwitches} cambios` : ''}</div>
        </div>
        <div style="min-width:130px">
          <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
          <div class="text-xs text-muted mt-1">${progress}% completado</div>
        </div>
        <span class="badge ${s.finished ? 'badge-green' : 'badge-yellow'}">${s.finished ? `${pct}%` : 'En curso'}</span>
      </div>
    `;
  }).join('');
}

// ── Load Exams List ────────────────────────────────────────
async function loadExamsList() {
  const container = document.getElementById('exams-list');
  if (!container) return;
  const snap = await getDocs(query(collection(db, 'exams'), orderBy('createdAt', 'desc')));
  if (snap.empty) {
    container.innerHTML = `<div class="text-center text-muted mt-5"><div style="font-size:2.5rem">📝</div><p class="mt-2">Sin evaluaciones. Crea una usando el importador.</p></div>`;
    return;
  }
  container.innerHTML = snap.docs.map(d => {
    const e = d.data();
    return `
      <div class="student-row">
        <div class="stat-icon" style="background:rgba(108,99,255,.15)">📋</div>
        <div class="student-info">
          <div class="student-name">${e.title}</div>
          <div class="student-meta">${e.questions?.length || 0} preguntas · ${e.nivel || 'Todos'}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-primary" onclick="openStartExamModal('${d.id}','${e.title.replace(/'/g,"\\'")}',${e.questions?.length||0})">▶ Iniciar</button>
          <button class="btn btn-sm btn-ghost" onclick="previewExam('${d.id}')">👁</button>
          <button class="btn btn-sm btn-red" onclick="deleteExam('${d.id}')">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

window.deleteExam = async function(id) {
  if (!confirm('¿Eliminar esta evaluación?')) return;
  await deleteDoc(doc(db, 'exams', id));
  loadExamsList();
  toast('Evaluación eliminada', 'info');
};

window.previewExam = async function(id) {
  const snap = await getDoc(doc(db, 'exams', id));
  if (!snap.exists()) return;
  const e = snap.data();
  const container = document.getElementById('preview-modal-content');
  container.innerHTML = `
    <h3 class="mb-3">${e.title}</h3>
    <div class="question-preview scroll-list">
      ${e.questions.map((q, i) => `
        <div class="question-preview-item">
          <span class="q-num">${i+1}</span>
          <div>
            <div class="font-semibold text-sm">${q.question}</div>
            <div class="chip-group mt-2">
              ${q.options.map((o, j) => `<span class="chip ${j===q.correctIndex?'active':''}">${['A','B','C','D'][j]}. ${o}</span>`).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  openModal('preview-modal');
};

// ── Start Exam Modal ───────────────────────────────────────
window.openStartExamModal = function(examId, title, count) {
  document.getElementById('start-exam-id').value = examId;
  document.getElementById('start-exam-title-display').textContent = title;
  document.getElementById('start-exam-count').textContent = count + ' preguntas';
  openModal('start-exam-modal');
};

document.getElementById('btn-confirm-start-exam').addEventListener('click', async () => {
  const examId = document.getElementById('start-exam-id').value;
  const nivel  = document.getElementById('start-exam-nivel').value;
  const mins   = parseInt(document.getElementById('start-exam-mins').value) || 30;
  const title  = document.getElementById('start-exam-title-display').textContent;
  setLoading('btn-confirm-start-exam', true);
  try {
    // Clear previous sessions & progress
    const prevSessions = await getDocs(collection(db, 'sessions'));
    const prevProgress = await getDocs(collection(db, 'examProgress'));
    const batch = writeBatch(db);
    prevSessions.docs.forEach(d => batch.delete(d.ref));
    prevProgress.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    // Set active exam
    await setDoc(doc(db, 'config', 'activeExam'), {
      active: true,
      examId, nivel, title,
      durationMinutes: mins,
      startedAt: serverTimestamp(),
      resultsVisible: false
    });
    closeModal('start-exam-modal');
    toast(`✅ Evaluación "${title}" iniciada para ${nivel}`, 'success');
    startGlobalTimer(mins * 60);
  } catch(e) {
    toast('Error al iniciar: ' + e.message, 'error');
  } finally {
    setLoading('btn-confirm-start-exam', false);
  }
});

// ── Stop Exam ──────────────────────────────────────────────
document.getElementById('btn-stop-exam').addEventListener('click', async () => {
  if (!confirm('¿Detener la evaluación actual?')) return;
  await setDoc(doc(db, 'config', 'activeExam'), { active: false }, { merge: true });
  clearInterval(globalTimerInterval);
  toast('Evaluación detenida', 'info');
});

// ── Show Results (Admin) ───────────────────────────────────
document.getElementById('btn-show-results').addEventListener('click', async () => {
  if (!confirm('¿Mostrar resultados a todos los estudiantes?')) return;
  await setDoc(doc(db, 'config', 'activeExam'), { resultsVisible: true }, { merge: true });
  // Update all results docs
  const resultsSnap = await getDocs(collection(db, 'results'));
  const batch = writeBatch(db);
  resultsSnap.docs.forEach(d => batch.update(d.ref, { resultsVisible: true }));
  await batch.commit();
  toast('✅ Resultados visibles para todos', 'success');
});

// ── Add Late Student ───────────────────────────────────────
document.getElementById('btn-add-late').addEventListener('click', () => openModal('late-student-modal'));

document.getElementById('btn-confirm-add-late').addEventListener('click', async () => {
  const email = document.getElementById('late-email').value.trim();
  if (!email) { toast('Ingresa el email del estudiante', 'error'); return; }
  try {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) { toast('Estudiante no encontrado', 'error'); return; }
    const student = snap.docs[0].data();
    await setDoc(doc(db, 'examProgress', snap.docs[0].id), {
      uid: snap.docs[0].id,
      name: student.name,
      nivel: student.nivel,
      curso: student.curso,
      finished: false,
      answers: {},
      examId: activeExam?.examId,
      lateEntry: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
    closeModal('late-student-modal');
    toast(`✅ ${student.name} habilitado como tardío`, 'success');
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
});

// ── Global Timer (Admin) ───────────────────────────────────
function startGlobalTimer(totalSeconds) {
  clearInterval(globalTimerInterval);
  examGlobalTimer = totalSeconds;
  updateAdminTimer();
  globalTimerInterval = setInterval(() => {
    examGlobalTimer--;
    updateAdminTimer();
    if (examGlobalTimer <= 0) {
      clearInterval(globalTimerInterval);
      toast('⏰ Tiempo terminado. La evaluación finalizará automáticamente.', 'warning', 5000);
    }
  }, 1000);
}

function updateAdminTimer() {
  const el = document.getElementById('admin-global-timer');
  if (!el) return;
  const m = Math.floor(examGlobalTimer / 60);
  const s = examGlobalTimer % 60;
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

document.getElementById('btn-add-time').addEventListener('click', () => {
  examGlobalTimer += 300; // +5 min
  updateAdminTimer();
  toast('+5 minutos añadidos', 'success');
});

// ══════════════════════════════════════════════════════════
//  TXT IMPORTER
// ══════════════════════════════════════════════════════════

const importZone = document.getElementById('import-drop-zone');
const importTextarea = document.getElementById('import-textarea');

importZone.addEventListener('dragover', e => { e.preventDefault(); importZone.classList.add('drag'); });
importZone.addEventListener('dragleave', () => importZone.classList.remove('drag'));
importZone.addEventListener('drop', e => {
  e.preventDefault(); importZone.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) readTxtFile(file);
});
importZone.addEventListener('click', () => document.getElementById('import-file-input').click());
document.getElementById('import-file-input').addEventListener('change', e => {
  if (e.target.files[0]) readTxtFile(e.target.files[0]);
});

function readTxtFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    importTextarea.value = e.target.result;
    parseAndPreviewQuestions();
  };
  reader.readAsText(file);
}

importTextarea.addEventListener('input', () => {
  clearTimeout(importTextarea._timer);
  importTextarea._timer = setTimeout(parseAndPreviewQuestions, 600);
});

function parseTxt(text) {
  const questions = [];
  const errors = [];
  // Split by question numbers
  const blocks = text.split(/(?=^\d+\.)/m).filter(b => b.trim());
  blocks.forEach((block, idx) => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const questionLine = lines[0].replace(/^\d+\.\s*/, '').trim();
    if (!questionLine) { errors.push(`Bloque ${idx+1}: pregunta vacía`); return; }
    const options = [];
    let correctIndex = -1;
    lines.slice(1).forEach(line => {
      const match = line.match(/^([ABCD])\.\s*(.*?)(\s+R\s*)?$/i);
      if (match) {
        const text = match[2].trim().replace(/\s+R$/i, '');
        const isCorrect = line.toUpperCase().includes(' R') || line.toUpperCase().endsWith(' R');
        if (isCorrect) correctIndex = options.length;
        options.push(text);
      }
    });
    if (options.length < 2) { errors.push(`Pregunta ${idx+1}: necesita al menos 2 opciones`); return; }
    if (correctIndex === -1) { errors.push(`Pregunta ${idx+1}: sin respuesta correcta (agrega R)`); return; }
    questions.push({ question: questionLine, options, correctIndex });
  });
  return { questions, errors };
}

function parseAndPreviewQuestions() {
  const text = importTextarea.value;
  if (!text.trim()) { document.getElementById('import-preview').classList.add('hidden'); return; }
  const { questions, errors } = parseTxt(text);
  const preview = document.getElementById('import-preview');
  preview.classList.remove('hidden');
  if (errors.length) {
    document.getElementById('import-errors').innerHTML = errors.map(e => `<div class="alert alert-warning mt-1"><span>⚠️</span>${e}</div>`).join('');
  } else {
    document.getElementById('import-errors').innerHTML = '';
  }
  document.getElementById('import-count').textContent = questions.length + ' preguntas detectadas';
  document.getElementById('import-questions-preview').innerHTML = questions.slice(0, 5).map((q, i) => `
    <div class="question-preview-item">
      <span class="q-num">${i+1}</span>
      <div>
        <div class="font-semibold text-sm">${q.question}</div>
        <div class="chip-group mt-1">${q.options.map((o,j) => `<span class="chip ${j===q.correctIndex?'active':''} text-xs" style="padding:3px 8px">${['A','B','C','D'][j]}. ${o}</span>`).join('')}</div>
      </div>
    </div>
  `).join('') + (questions.length > 5 ? `<div class="text-center text-muted text-sm mt-2">... y ${questions.length - 5} más</div>` : '');
  document.getElementById('btn-save-exam').dataset.questions = JSON.stringify(questions);
  document.getElementById('btn-save-exam').disabled = questions.length === 0;
}

document.getElementById('btn-save-exam').addEventListener('click', async () => {
  const title = document.getElementById('import-exam-title').value.trim();
  if (!title) { toast('Agrega un título a la evaluación', 'error'); return; }
  const raw = document.getElementById('btn-save-exam').dataset.questions;
  if (!raw) { toast('Primero importa las preguntas', 'error'); return; }
  const questions = JSON.parse(raw);
  setLoading('btn-save-exam', true);
  try {
    await addDoc(collection(db, 'exams'), {
      title,
      questions,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });
    toast(`✅ Evaluación "${title}" guardada con ${questions.length} preguntas`, 'success');
    document.getElementById('import-exam-title').value = '';
    importTextarea.value = '';
    document.getElementById('import-preview').classList.add('hidden');
    loadExamsList();
    // Go to exams tab
    switchAdminTab('tab-exams');
  } catch(e) {
    toast('Error al guardar: ' + e.message, 'error');
  } finally {
    setLoading('btn-save-exam', false);
  }
});

// ── Admin Tabs ─────────────────────────────────────────────
window.switchAdminTab = function(tabId) {
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.remove('hidden');
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
};

// ── Student View Tabs ──────────────────────────────────────
window.switchStudentTab = function(tabId) {
  document.querySelectorAll('.student-tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.student-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.remove('hidden');
  document.querySelector(`[data-stab="${tabId}"]`)?.classList.add('active');
};

// ── Export Admin Results CSV ───────────────────────────────
document.getElementById('btn-export-results').addEventListener('click', async () => {
  const snap = await getDocs(collection(db, 'results'));
  if (snap.empty) { toast('Sin resultados para exportar', 'info'); return; }
  let csv = 'Nombre,Email,Nivel,Curso,Correctas,Total,Porcentaje\n';
  snap.docs.forEach(d => {
    const r = d.data();
    csv += `"${r.name}","${r.email}","${r.nivel}","${r.curso}",${r.correct},${r.total},${r.percentage}%\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'resultados.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado', 'success');
});

// ── Manage Students ────────────────────────────────────────
document.getElementById('btn-manage-students').addEventListener('click', async () => {
  const snap = await getDocs(collection(db, 'users'));
  const container = document.getElementById('manage-students-list');
  container.innerHTML = snap.docs.map(d => {
    const s = d.data();
    if (s.role === 'admin') return '';
    return `
      <div class="student-row">
        <div class="avatar" style="width:34px;height:34px;min-width:34px;font-size:.8rem">${(s.name||'?').substring(0,2).toUpperCase()}</div>
        <div class="student-info">
          <div class="student-name">${s.name}</div>
          <div class="student-meta">${s.nivel} · ${s.curso} · ${s.email}</div>
        </div>
        <button class="btn btn-sm btn-red" onclick="deleteStudent('${d.id}')">🗑</button>
      </div>
    `;
  }).join('');
  openModal('manage-students-modal');
});

window.deleteStudent = async function(uid) {
  if (!confirm('¿Eliminar este estudiante?')) return;
  await deleteDoc(doc(db, 'users', uid));
  toast('Estudiante eliminado', 'info');
  document.getElementById('btn-manage-students').click();
};

// ── Nav Handlers ────────────────────────────────────────────
document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => {
    const target = el.dataset.nav;
    if (target === 'page-admin' && !isAdmin) return;
    showPage(target);
    if (target === 'page-admin') renderAdminDashboard();
    if (target === 'page-student') renderStudentDashboard();
  });
});

// Bottom nav
document.querySelectorAll('.bottom-nav-item').forEach(el => {
  el.addEventListener('click', () => {
    const target = el.dataset.nav;
    if (target === 'page-admin' && !isAdmin) return;
    showPage(target);
    if (target === 'page-admin') renderAdminDashboard();
    if (target === 'page-student') loadStudentHistory();
  });
});
