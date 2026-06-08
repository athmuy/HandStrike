/* ═══════════════════════════════════════
   app.js - FIXED: draw from webcam.video
═══════════════════════════════════════ */

const HOLD_DURATION = 1500;
const CONFIDENCE_THRESHOLD = 0.75;
const DEFAULT_MODEL_URL = "https://teachablemachine.withgoogle.com/models/rsT6VZXS5/";

let model = null;
let webcam = null;
let isCameraMode = false;
let currentQ = 0;
let score = 0;
let correctCount = 0;
let gameStartTime = null;
let currentGesture = null;
let holdStartTime = null;
let isAnswering = false;
let isCooldown = false;
let cooldownTimer = null;
let predictionLoop = null;
let classLabels = { left: 'kiri', right: 'kanan', neutral: 'netral' };

// Screen navigation
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

// Keyboard fallback
function skipToGame() {
  isCameraMode = false;
  document.querySelector('.cam-panel').style.opacity = '0.5';
  document.querySelector('.cam-panel').style.pointerEvents = 'none';
  
  // Load selected level quiz data
  const levelSelect = document.getElementById('level-select');
  const selectedLevel = levelSelect ? levelSelect.value : 'smp';
  QUIZ_DATA = getQuizDataForLevel(selectedLevel);
  
  showScreen('game');
  loadQuestionWithCooldown(0);
  gameStartTime = Date.now();
  document.addEventListener('keydown', keyboardFallback);
}

function keyboardFallback(e) {
  if (isAnswering) return;
  if (e.key === 'ArrowLeft') submitAnswer('left');
  if (e.key === 'ArrowRight') submitAnswer('right');
}

// Load model & camera


function setStatus(type, html) {
  const el = document.getElementById('setup-status');
  el.className = 'setup-status ' + type;
  el.innerHTML = html;
}

function startCountdown() {
  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-num');
  overlay.style.display = 'flex';
  
  // Load selected level quiz data
  const levelSelect = document.getElementById('level-select');
  const selectedLevel = levelSelect ? levelSelect.value : 'smp';
  QUIZ_DATA = getQuizDataForLevel(selectedLevel);
  
  let count = 3;
  numEl.textContent = count;
  const iv = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(iv);
      overlay.style.display = 'none';
      showScreen('game');
      loadQuestionWithCooldown(0);
      gameStartTime = Date.now();
      if (isCameraMode) startPredictionLoop();
    } else {
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = 'countPop 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      numEl.textContent = count;
    }
  }, 1000);
}

// Load model & camera - FIXED: pakai getUserMedia native
async function loadModel() {
  if (typeof window.tmPose === 'undefined') {
    setStatus('error', '❌ Library belum termuat. Refresh halaman (Ctrl+F5).');
    return;
  }

  let urlInput = document.getElementById('model-url-input').value.trim();
  if (!urlInput) {
    urlInput = DEFAULT_MODEL_URL;
    document.getElementById('model-url-input').value = DEFAULT_MODEL_URL;
  }

  classLabels.left    = document.getElementById('label-left').value    || 'kiri';
  classLabels.right   = document.getElementById('label-right').value   || 'kanan';
  classLabels.neutral = document.getElementById('label-neutral').value || 'netral';

  const modelURL = urlInput.endsWith('/') ? urlInput : urlInput + '/';
  setStatus('loading', '<span class="spinner"></span> Memuat model...');

  try {
    model = await window.tmPose.load(modelURL + 'model.json', modelURL + 'metadata.json');
    setStatus('loading', '<span class="spinner"></span> Membuka kamera...');

    // Gunakan getUserMedia native — jauh lebih stabil
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

    // Buat video element tersembunyi sebagai sumber frame
    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', true);
    video.muted = true;
    await video.play();

    // Simpan referensi video agar bisa dipakai di loop
    window._handstrike_video = video;

    isCameraMode = true;

    const canvas = document.getElementById('webcam-canvas');
    canvas.width  = 300;
    canvas.height = 300;

    setStatus('success', '✅ Model & kamera siap! 3 detik lagi...');
    setTimeout(() => startCountdown(), 800);
  } catch (err) {
    setStatus('error', '❌ Gagal: ' + err.message);
    console.error(err);
  }
}

async function startPredictionLoop() {
  if (!isCameraMode || !model) return;

  const canvas = document.getElementById('webcam-canvas');
  const ctx    = canvas.getContext('2d');
  const video  = window._handstrike_video;

  if (!ctx || !video) return;

  async function loop() {
    if (!isCameraMode || !model) return;

    try {
      // Gambar frame video ke canvas (mirror)
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      if (!isAnswering) {
        // Estimasi pose dari canvas
        const { pose, posenetOutput } = await model.estimatePose(canvas);
        const predictions = await model.predict(posenetOutput);

        // Overlay skeleton
        if (pose) {
          try {
            window.tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
            window.tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
          } catch(e) {}
        }

        // Parse prediksi
        let leftConf = 0, rightConf = 0, neutralConf = 0;
        predictions.forEach(p => {
          const name = p.className.toLowerCase();
          if      (name === classLabels.left.toLowerCase())    leftConf    = p.probability;
          else if (name === classLabels.right.toLowerCase())   rightConf   = p.probability;
          else    neutralConf = Math.max(neutralConf, p.probability);
        });

        updateBars(leftConf, rightConf, neutralConf);
        processGesture(leftConf, rightConf);
      } else {
        // Clear state bars/gestures when answering or in cooldown
        updateBars(0, 0, 0);
        document.getElementById('gesture-value').textContent = '—';
        document.getElementById('gesture-value').className   = 'gesture-value neutral';
        document.getElementById('hold-bar').style.width      = '0%';
        document.getElementById('choice-left').classList.remove('active');
        document.getElementById('choice-right').classList.remove('active');
      }

      predictionLoop = requestAnimationFrame(loop);
    } catch (err) {
      console.error("Loop error:", err);
      predictionLoop = requestAnimationFrame(loop);
    }
  }
  loop();
}

function stopPredictionLoop() {
  if (predictionLoop) cancelAnimationFrame(predictionLoop);
  predictionLoop = null;
}

function updateBars(l, r, n) {
  document.getElementById('bar-left').style.width    = (l * 100) + '%';
  document.getElementById('bar-right').style.width   = (r * 100) + '%';
  document.getElementById('bar-neutral').style.width = (n * 100) + '%';
  document.getElementById('pct-left').textContent    = Math.round(l * 100) + '%';
  document.getElementById('pct-right').textContent   = Math.round(r * 100) + '%';
  document.getElementById('pct-neutral').textContent = Math.round(n * 100) + '%';
}

function processGesture(leftConf, rightConf) {
  if (isAnswering) return;
  let detected = null;
  if      (leftConf  > CONFIDENCE_THRESHOLD && leftConf  > rightConf) detected = 'left';
  else if (rightConf > CONFIDENCE_THRESHOLD && rightConf > leftConf)  detected = 'right';

  const gestureEl = document.getElementById('gesture-value');
  const holdBar   = document.getElementById('hold-bar');

  if (detected) {
    gestureEl.textContent = detected === 'left' ? '← Kiri' : 'Kanan →';
    gestureEl.className   = 'gesture-value ' + detected;
    document.getElementById('choice-left').classList.toggle('active',  detected === 'left');
    document.getElementById('choice-right').classList.toggle('active', detected === 'right');

    if (detected !== currentGesture) {
      currentGesture = detected;
      holdStartTime  = Date.now();
    } else {
      const progress = Math.min((Date.now() - holdStartTime) / HOLD_DURATION, 1);
      holdBar.style.width = (progress * 100) + '%';
      if (progress >= 1) {
        holdBar.style.width = '0%';
        submitAnswer(detected);
      }
    }
  } else {
    gestureEl.textContent = '—';
    gestureEl.className   = 'gesture-value neutral';
    currentGesture  = null;
    holdStartTime   = null;
    holdBar.style.width = '0%';
    document.getElementById('choice-left').classList.remove('active');
    document.getElementById('choice-right').classList.remove('active');
  }
}

function loadQuestion(index) {
  if (index >= QUIZ_DATA.length) return endGame();
  currentQ       = index;
  isAnswering    = false;
  currentGesture = null;
  holdStartTime  = null;
  document.getElementById('hold-bar').style.width    = '0%';
  document.getElementById('choice-left').className  = 'choice-card left';
  document.getElementById('choice-right').className = 'choice-card right';
  const q = QUIZ_DATA[index];
  document.getElementById('q-number').textContent          = 'Pertanyaan ' + (index + 1);
  document.getElementById('q-text').textContent            = q.question;
  document.getElementById('choice-left-text').textContent  = q.left;
  document.getElementById('choice-right-text').textContent = q.right;
  const pct = ((index + 1) / QUIZ_DATA.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = (index + 1) + ' / ' + QUIZ_DATA.length;
}

function submitAnswer(side) {
  if (isAnswering) return;
  isAnswering = true;
  // Kita tidak mematikan loop kamera agar feed tetap jalan
  const q         = QUIZ_DATA[currentQ];
  const isCorrect = side === q.correct;
  if (isCorrect) {
    score += 10;
    correctCount++;
    document.getElementById('score-display').textContent = score;
  }
  document.getElementById('choice-' + q.correct).classList.add('correct');
  if (!isCorrect) {
    const wrongSide = q.correct === 'left' ? 'right' : 'left';
    document.getElementById('choice-' + wrongSide).classList.add('wrong');
  }
  showFeedback(isCorrect);
  setTimeout(() => {
    hideFeedback();
    loadQuestionWithCooldown(currentQ + 1);
  }, 1500);
}

function showFeedback(isCorrect) {
  const overlay = document.getElementById('feedback-overlay');
  const bubble  = document.getElementById('feedback-bubble');
  bubble.textContent = isCorrect ? '✓' : '✗';
  bubble.className   = 'feedback-bubble ' + (isCorrect ? 'correct' : 'wrong');
  overlay.classList.add('show');
}
function hideFeedback() { document.getElementById('feedback-overlay').classList.remove('show'); }

function loadQuestionWithCooldown(index) {
  if (index >= QUIZ_DATA.length) return endGame();
  
  isCooldown = true;
  isAnswering = true; // Kunci input selama cooldown
  
  // Muat pertanyaan baru (akan mengeset isAnswering ke false)
  loadQuestion(index);
  
  // Set kembali ke true selama cooldown
  isAnswering = true;
  
  const choiceLeft = document.getElementById('choice-left');
  const choiceRight = document.getElementById('choice-right');
  choiceLeft.classList.add('cooldown');
  choiceRight.classList.add('cooldown');
  
  let cooldownLeft = 1.5;
  const holdTimerLabel = document.querySelector('.hold-timer-label');
  holdTimerLabel.textContent = `✋ Turunkan tangan & Bersiap... (${cooldownLeft.toFixed(1)}s)`;
  
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    cooldownLeft -= 0.1;
    if (cooldownLeft <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      isCooldown = false;
      isAnswering = false; // Buka kunci input
      
      choiceLeft.classList.remove('cooldown');
      choiceRight.classList.remove('cooldown');
      holdTimerLabel.textContent = `⏳ Tahan 1.5 detik untuk jawab`;
    } else {
      holdTimerLabel.textContent = `✋ Turunkan tangan & Bersiap... (${cooldownLeft.toFixed(1)}s)`;
    }
  }, 100);
}

function endGame() {
  stopPredictionLoop();
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  isCooldown = false;
  // Hentikan stream kamera native
  const video = window._handstrike_video;
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    window._handstrike_video = null;
  }
  document.removeEventListener('keydown', keyboardFallback);
  const total   = QUIZ_DATA.length;
  const pct     = Math.round((correctCount / total) * 100);
  const elapsed = Math.round((Date.now() - gameStartTime) / 1000);
  const timeStr = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  document.getElementById('result-trophy').textContent = pct >= 80 ? '🏆' : pct >= 50 ? '🥈' : '🥉';
  document.getElementById('result-pct').textContent    = pct + '%';
  document.getElementById('result-label').textContent  = `Benar ${correctCount} dari ${total}`;
  document.getElementById('stat-correct').textContent  = correctCount;
  document.getElementById('stat-wrong').textContent    = total - correctCount;
  document.getElementById('stat-time').textContent     = timeStr;
  showScreen('result');
}

function restartGame() {
  currentQ = 0; score = 0; correctCount = 0; gameStartTime = null;
  currentGesture = null; holdStartTime = null; isAnswering = false;
  isCooldown = false;
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  
  // Re-load selected level quiz data
  const levelSelect = document.getElementById('level-select');
  const selectedLevel = levelSelect ? levelSelect.value : 'smp';
  QUIZ_DATA = getQuizDataForLevel(selectedLevel);
  
  document.getElementById('score-display').textContent = '0';
  document.getElementById('hold-bar').style.width = '0%';
  updateBars(0, 0, 0);
  document.getElementById('gesture-value').textContent = '—';
  showScreen('game');
  loadQuestionWithCooldown(0);
  gameStartTime = Date.now();
  if (isCameraMode && window._handstrike_video) {
    window._handstrike_video.play();
    startPredictionLoop();
  } else {
    document.addEventListener('keydown', keyboardFallback);
  }
}

/* ═══════════════════════════════════════
   FUNGSI MANAJEMEN BANK SOAL (MODAL UI)
   ═══════════════════════════════════════ */

function openQuestionManager() {
  const managerSelect = document.getElementById('manager-level-select');
  const mainSelect = document.getElementById('level-select');
  if (managerSelect && mainSelect) {
    managerSelect.value = mainSelect.value;
  }
  document.getElementById('modal-question-manager').classList.add('active');
  renderQuestionList();
}

function closeQuestionManager() {
  document.getElementById('modal-question-manager').classList.remove('active');
  // Sinkronisasi pilihan tingkat pendidikan kembali ke halaman utama
  const managerSelect = document.getElementById('manager-level-select');
  const mainSelect = document.getElementById('level-select');
  if (managerSelect && mainSelect) {
    mainSelect.value = managerSelect.value;
  }
}

function renderQuestionList() {
  const level = document.getElementById('manager-level-select').value;
  const questions = getQuizDataForLevel(level);
  const tbody = document.getElementById('question-table-body');
  tbody.innerHTML = '';
  
  questions.forEach((q, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(q.question)}</strong></td>
      <td>${escapeHtml(q.left)}</td>
      <td>${escapeHtml(q.right)}</td>
      <td><span style="font-weight: 800; color: ${q.correct === 'left' ? 'var(--blue)' : 'var(--red)'}">${q.correct === 'left' ? 'Kiri' : 'Kanan'}</span></td>
      <td>
        <button class="btn-primary-sm" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;" onclick="editQuestion(${idx})">✏️</button>
        <button class="btn-danger-sm" style="padding: 4px 8px; font-size: 11px;" onclick="deleteQuestion(${idx})">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  cancelEdit();
}

function editQuestion(index) {
  const level = document.getElementById('manager-level-select').value;
  const questions = getQuizDataForLevel(level);
  const q = questions[index];
  
  document.getElementById('edit-question-index').value = index;
  document.getElementById('input-q-text').value = q.question;
  document.getElementById('input-q-left').value = q.left;
  document.getElementById('input-q-right').value = q.right;
  document.getElementById('input-q-correct').value = q.correct;
  
  document.getElementById('form-title').textContent = `✏️ Edit Pertanyaan #${index + 1}`;
  document.getElementById('btn-cancel-edit').style.display = 'inline-block';
  
  // Scroll form ke area input
  document.querySelector('.question-form-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelEdit() {
  document.getElementById('edit-question-index').value = "-1";
  document.getElementById('input-q-text').value = "";
  document.getElementById('input-q-left').value = "";
  document.getElementById('input-q-right').value = "";
  document.getElementById('input-q-correct').value = "left";
  
  document.getElementById('form-title').textContent = "➕ Tambah Pertanyaan Baru";
  document.getElementById('btn-cancel-edit').style.display = 'none';
}

function saveQuestion() {
  const level = document.getElementById('manager-level-select').value;
  const questions = getQuizDataForLevel(level);
  
  const qText = document.getElementById('input-q-text').value.trim();
  const qLeft = document.getElementById('input-q-left').value.trim();
  const qRight = document.getElementById('input-q-right').value.trim();
  const qCorrect = document.getElementById('input-q-correct').value;
  const editIndex = parseInt(document.getElementById('edit-question-index').value);
  
  if (!qText || !qLeft || !qRight) {
    alert("Maaf, semua kolom (Teks Pertanyaan, Pilihan Kiri, Pilihan Kanan) wajib diisi!");
    return;
  }
  
  const newQuestion = {
    question: qText,
    left: qLeft,
    right: qRight,
    correct: qCorrect
  };
  
  if (editIndex === -1) {
    questions.push(newQuestion);
  } else {
    questions[editIndex] = newQuestion;
  }
  
  saveQuizDataForLevel(level, questions);
  renderQuestionList();
}

function deleteQuestion(index) {
  if (!confirm("Apakah Anda yakin ingin menghapus pertanyaan ini dari bank soal?")) return;
  
  const level = document.getElementById('manager-level-select').value;
  const questions = getQuizDataForLevel(level);
  questions.splice(index, 1);
  
  saveQuizDataForLevel(level, questions);
  renderQuestionList();
}

function resetQuestionsToDefault() {
  const level = document.getElementById('manager-level-select').value;
  let levelName = "";
  if (level === 'sd') levelName = "Sekolah Dasar (SD)";
  else if (level === 'smp') levelName = "Sekolah Menengah Pertama (SMP)";
  else if (level === 'sma') levelName = "Sekolah Menengah Atas (SMA)";
  else if (level === 'mahasiswa') levelName = "Perguruan Tinggi (Mahasiswa)";
  
  if (!confirm(`Apakah Anda yakin ingin mengatur ulang kategori ${levelName} ke setelan bawaan? Seluruh perubahan kustom Anda pada kategori ini akan hilang.`)) return;
  
  resetQuizDataForLevel(level);
  renderQuestionList();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('model-url-input');
  if (input) input.value = DEFAULT_MODEL_URL;
});