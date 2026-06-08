const HOLD_DURATION = 1500; 
// ini buat ngatur berapa lama gesture harus ditahan biar kebaca jawabannya

const CONFIDENCE_THRESHOLD = 0.75; 
// ini batas minimal keyakinan ai buat nentuin gesture nya valid apa nggak

const DEFAULT_MODEL_URL = "https://teachablemachine.withgoogle.com/models/rsT6VZXS5/";
const TEACHER_PIN = "1234"; // Ganti PIN Guru di sini jika ingin mengubah password/PIN

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
let lastPredictionTime = 0;
const PREDICTION_INTERVAL = 100; // run AI predictions every 100ms (10 FPS) to prevent CPU lag and crashes
let classLabels = { left: 'kiri', right: 'kanan', neutral: 'netral' };
// label gesture dari teachable machine


// ==========================
// pindah tampilan screen
// ==========================

// Data sesi aktif siswa
let studentName = "Siswa Baru";
let studentClass = "7-A";
let activeLevel = "smp";

// Screen navigation
function showScreen(id) {

  // hapus active dari semua screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // tampilin screen yang dipilih
  document.getElementById('screen-' + id).classList.add('active');
  
  // Jika kembali ke beranda (intro), matikan kamera secara total
  if (id === 'intro') {
    stopCameraStream();
  }
}

function stopCameraStream() {
  stopPredictionLoop();
  const video = window._handstrike_video;
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    window._handstrike_video = null;
  }
  isCameraMode = false;
}

// Keyboard fallback
async function skipToGame() {
  isCameraMode = false;
  // matiin mode kamera

  document.querySelector('.cam-panel').style.opacity = '0.5';
  // bikin panel kamera agak redup

  document.querySelector('.cam-panel').style.pointerEvents = 'none';
  
  // Ambil nama dan kelas siswa
  const nameInput = document.getElementById('student-name');
  const classInput = document.getElementById('student-class');
  studentName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : "Siswa Baru";
  studentClass = classInput && classInput.value.trim() ? classInput.value.trim() : "7-A";
  
  // Load selected level quiz data
  const levelSelect = document.getElementById('level-select');
  const selectedLevel = levelSelect ? levelSelect.value : 'smp';
  activeLevel = selectedLevel;
  QUIZ_DATA = await getQuizDataForLevel(selectedLevel);
  
  showScreen('game');
  loadQuestionWithCooldown(0);
  gameStartTime = Date.now();
  // mulai hitung waktu game

  document.addEventListener('keydown', keyboardFallback);
  // aktifin kontrol keyboard
}


// ==========================
// kontrol keyboard
// ==========================

function keyboardFallback(e) {

  if (isAnswering) return;
  // kalau lagi jawab jangan baca tombol dulu

  if (e.key === 'ArrowLeft') submitAnswer('left');
  // tombol kiri buat pilih jawaban kiri

  if (e.key === 'ArrowRight') submitAnswer('right');
  // tombol kanan buat pilih jawaban kanan
}

// Load model & camera


function setStatus(type, html) {
  const el = document.getElementById('setup-status');
  el.className = 'setup-status ' + type;
  el.innerHTML = html;
}

async function startCountdown() {
  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-num');
  overlay.style.display = 'flex';
  
  // Ambil nama dan kelas siswa
  const nameInput = document.getElementById('student-name');
  const classInput = document.getElementById('student-class');
  studentName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : "Siswa Baru";
  studentClass = classInput && classInput.value.trim() ? classInput.value.trim() : "7-A";
  
  // Load selected level quiz data
  const levelSelect = document.getElementById('level-select');
  const selectedLevel = levelSelect ? levelSelect.value : 'smp';
  activeLevel = selectedLevel;
  QUIZ_DATA = await getQuizDataForLevel(selectedLevel);
  
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

  // ngecek library tm nya kebaca atau nggak
  if (typeof window.tmPose === 'undefined') {
    setStatus('error', '❌ library belum kebaca, coba refresh');
    return;
  }

  // ambil url model dari input
  let urlInput = document.getElementById('model-url-input').value.trim();

  // kalau kosong pake default
  if (!urlInput) {
    urlInput = DEFAULT_MODEL_URL;
    document.getElementById('model-url-input').value = DEFAULT_MODEL_URL;
  }

  // ambil nama label gesture
  classLabels.left    = document.getElementById('label-left').value    || 'kiri';
  classLabels.right   = document.getElementById('label-right').value   || 'kanan';
  classLabels.neutral = document.getElementById('label-neutral').value || 'netral';

  // benerin format url
  const modelURL = urlInput.endsWith('/') ? urlInput : urlInput + '/';

  // kasih status loading
  setStatus('loading', 'lagi load model ai...');

  try {

    // ini buat nyambungin ke model teachable machine
    model = await window.tmPose.load(
      modelURL + 'model.json',
      modelURL + 'metadata.json'
    );

    // kasih status buka kamera
    setStatus('loading', 'lagi buka kamera...');

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

    // status kalau semua udah siap
    setStatus('success', 'model sama kamera udah siap');

    // mulai countdown
    setTimeout(() => startCountdown(), 800);

  } catch (err) {

    // kalau error tampilin pesan
    setStatus('error', 'gagal load: ' + err.message);

    console.error(err);
  }
}

async function startPredictionLoop() {
  if (!isCameraMode || !model) return;

  const canvas = document.getElementById('webcam-canvas');
  const ctx    = canvas.getContext('2d');
  const video  = window._handstrike_video;

  if (!ctx || !video) return;

  lastPredictionTime = 0; // Reset last prediction time on start

  async function loop() {
    if (!isCameraMode || !model) return;

    try {
      // Gambar frame video ke canvas (mirror) - Selalu jalankan di setiap frame agar preview kamera mulus 60 FPS
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const now = Date.now();
      if (!isAnswering && (now - lastPredictionTime >= PREDICTION_INTERVAL)) {
        lastPredictionTime = now;

        // Estimasi pose dari canvas
        const { pose, posenetOutput } = await model.estimatePose(canvas);
        
        let leftConf = 0, rightConf = 0, neutralConf = 1.0;
        const POSE_CONF_THRESHOLD = 0.15; // Ambang batas deteksi manusia (diatur ke 0.15 agar cocok untuk webcam setengah badan)

        // Hanya deteksi gestur jika ada orang yang terdeteksi secara jelas
        if (pose && pose.score > POSE_CONF_THRESHOLD) {
          const predictions = await model.predict(posenetOutput);

          // Parse prediksi gestur
          leftConf = 0;
          rightConf = 0;
          neutralConf = 0;
          predictions.forEach(p => {
            const name = p.className.toLowerCase();
            if      (name === classLabels.left.toLowerCase())    leftConf    = p.probability;
            else if (name === classLabels.right.toLowerCase())   rightConf   = p.probability;
            else    neutralConf = Math.max(neutralConf, p.probability);
          });
        }

        updateBars(leftConf, rightConf, neutralConf);
        processGesture(leftConf, rightConf);
      } else if (isAnswering) {
        // Clear state bars/gestures when answering or in cooldown
        updateBars(0, 0, 0);
        document.getElementById('gesture-value').textContent = '—';
        document.getElementById('gesture-value').className   = 'gesture-value neutral';
        document.getElementById('hold-bar').style.width      = '0%';
        document.getElementById('choice-left').classList.remove('active');
        document.getElementById('choice-right').classList.remove('active');
        const camWrap = document.querySelector('.cam-view-wrap');
        if (camWrap) {
          camWrap.className = 'cam-view-wrap';
        }
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
  const camWrap   = document.querySelector('.cam-view-wrap');

  if (detected) {
    gestureEl.textContent = detected === 'left' ? '← Kiri' : 'Kanan →';
    gestureEl.className   = 'gesture-value ' + detected;
    document.getElementById('choice-left').classList.toggle('active',  detected === 'left');
    document.getElementById('choice-right').classList.toggle('active', detected === 'right');
    if (camWrap) {
      camWrap.className = 'cam-view-wrap active-' + detected;
    }

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
    if (camWrap) {
      camWrap.className = 'cam-view-wrap';
    }
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
  
  // Putar efek suara ding/bzz
  playSound(isCorrect ? 'correct' : 'wrong');
  
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
  const emoji = isCorrect ? '✔️' : '❌';
  bubble.innerHTML = `<img class="apple-emoji" style="width: 80px; height: 80px;" src="https://emojicdn.elk.sh/${emoji}" alt="${emoji}">`;
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
  holdTimerLabel.innerHTML = `<img class="apple-emoji" src="https://emojicdn.elk.sh/✋" alt="✋"> Turunkan tangan & Bersiap... (${cooldownLeft.toFixed(1)}s)`;
  
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
      holdTimerLabel.innerHTML = `<img class="apple-emoji" src="https://emojicdn.elk.sh/⏳" alt="⏳"> Tahan 1.5 detik untuk jawab`;
    } else {
      holdTimerLabel.innerHTML = `<img class="apple-emoji" src="https://emojicdn.elk.sh/✋" alt="✋"> Turunkan tangan & Bersiap... (${cooldownLeft.toFixed(1)}s)`;
    }
  }, 100);
}

async function endGame() {
  stopPredictionLoop();
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  isCooldown = false;
  document.removeEventListener('keydown', keyboardFallback);
  const total   = QUIZ_DATA.length;
  const pct     = Math.round((correctCount / total) * 100);
  const elapsed = Math.round((Date.now() - gameStartTime) / 1000);
  const timeStr = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  // Simpan skor siswa ke database secara asinkron
  await saveStudentScore(studentName, studentClass, activeLevel, score, pct, timeStr);

  // Memuat peringkat kelas terbaru secara real-time
  await loadClassLeaderboard(pct, timeStr);

  // Putar efek suara kemenangan
  playSound('win');

  const trophyImg = pct >= 80 ? '🏆' : pct >= 50 ? '🥈' : '🥉';
  document.getElementById('result-trophy').innerHTML = `<img class="apple-emoji" style="width: 72px; height: 72px;" src="https://emojicdn.elk.sh/${trophyImg}" alt="trophy">`;
  document.getElementById('result-pct').textContent    = pct + '%';
  document.getElementById('result-label').textContent  = `Benar ${correctCount} dari ${total}`;
  document.getElementById('stat-correct').textContent  = correctCount;
  document.getElementById('stat-wrong').textContent    = total - correctCount;
  document.getElementById('stat-time').textContent     = timeStr;
  showScreen('result');
}

async function loadClassLeaderboard(currentPct, currentTimeStr) {
  try {
    const scores = await getStudentScores();
    
    // Filter skor berdasarkan tingkat level dan kelas yang sama saja
    const classScores = scores.filter(s => 
      s.class_name.toLowerCase().trim() === studentClass.toLowerCase().trim() && 
      s.level === activeLevel
    );
    
    // Konversi string time_spent (contoh: "0m 45s") menjadi total detik untuk pengurutan
    function parseTimeToSec(timeStr) {
      if (!timeStr) return 999999;
      const parts = timeStr.split(' ');
      let sec = 0;
      parts.forEach(p => {
        if (p.endsWith('m')) sec += parseInt(p) * 60;
        else if (p.endsWith('s')) sec += parseInt(p);
      });
      return sec;
    }
    
    // Urutkan peringkat:
    // 1. Akurasi/Persentase Benar (descending)
    // 2. Waktu pengerjaan (ascending)
    // 3. Waktu simpan/submit paling awal (ascending)
    classScores.sort((a, b) => {
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }
      const secA = parseTimeToSec(a.time_spent);
      const secB = parseTimeToSec(b.time_spent);
      if (secA !== secB) {
        return secA - secB;
      }
      return new Date(a.created_at) - new Date(b.created_at);
    });
    
    // Setel judul tag kelas
    document.getElementById('leaderboard-class-tag').textContent = studentClass.toUpperCase();
    
    const tbody = document.getElementById('leaderboard-list-body');
    tbody.innerHTML = '';
    
    if (classScores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted); padding: 24px;">Belum ada riwayat pengerjaan kelas ini.</td></tr>';
      return;
    }
    
    classScores.forEach((s, idx) => {
      const tr = document.createElement('tr');
      
      // Jika data adalah milik siswa saat ini di permainan ini, beri highlight
      const isMe = s.student_name === studentName && s.accuracy === currentPct && s.time_spent === currentTimeStr;
      if (isMe) {
        tr.className = 'highlight-me';
      }
      
      let rankBadge = '';
      if (idx === 0) {
        rankBadge = `<img class="apple-emoji" src="https://emojicdn.elk.sh/🥇" alt="1">`;
      } else if (idx === 1) {
        rankBadge = `<img class="apple-emoji" src="https://emojicdn.elk.sh/🥈" alt="2">`;
      } else if (idx === 2) {
        rankBadge = `<img class="apple-emoji" src="https://emojicdn.elk.sh/🥉" alt="3">`;
      } else {
        rankBadge = `<span style="font-weight: 800; color: var(--muted); margin-left: 6px;">${idx + 1}</span>`;
      }
      
      tr.innerHTML = `
        <td style="text-align: center; vertical-align: middle;">${rankBadge}</td>
        <td>
          <strong>${escapeHtml(s.student_name)}</strong>
          ${isMe ? ' <span style="color: var(--purple); font-size: 11px; font-weight:800;">(Kamu)</span>' : ''}
        </td>
        <td><span style="font-weight: 800; color: ${s.accuracy >= 80 ? 'var(--green)' : s.accuracy >= 50 ? 'var(--yellow-d)' : 'var(--red-d)'}">${s.accuracy}%</span></td>
        <td>${escapeHtml(s.time_spent)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Gagal memuat papan peringkat:", err);
  }
}

async function restartGame() {
  currentQ = 0; score = 0; correctCount = 0; gameStartTime = null;
  currentGesture = null; holdStartTime = null; isAnswering = false;
  isCooldown = false;
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
  
  // Re-load selected level quiz data
  const levelSelect = document.getElementById('level-select');
  const selectedLevel = levelSelect ? levelSelect.value : 'smp';
  activeLevel = selectedLevel;
  QUIZ_DATA = await getQuizDataForLevel(selectedLevel);
  
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

let currentManagerQuestions = [];

function promptTeacherLogin() {
  const pin = prompt(`Masukkan PIN Guru untuk masuk ke dashboard pengajar (Default: ${TEACHER_PIN}):`);
  if (pin === TEACHER_PIN) {
    openQuestionManager();
  } else if (pin !== null) {
    alert("PIN salah! Akses ditolak.");
  }
}

function openQuestionManager() {
  const managerSelect = document.getElementById('manager-level-select');
  const mainSelect = document.getElementById('level-select');
  if (managerSelect && mainSelect) {
    managerSelect.value = mainSelect.value;
  }
  document.getElementById('modal-question-manager').classList.add('active');
  switchModalTab('questions'); // Set default active tab
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

function switchModalTab(tabName) {
  // Reset active tabs & contents
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  // Hide footer action buttons
  document.getElementById('footer-actions-questions').style.display = 'none';
  document.getElementById('footer-actions-scores').style.display = 'none';
  
  if (tabName === 'questions') {
    document.getElementById('btn-tab-questions').classList.add('active');
    document.getElementById('tab-content-questions').classList.add('active');
    document.getElementById('footer-actions-questions').style.display = 'block';
    renderQuestionList();
  } else if (tabName === 'scores') {
    document.getElementById('btn-tab-scores').classList.add('active');
    document.getElementById('tab-content-scores').classList.add('active');
    document.getElementById('footer-actions-scores').style.display = 'block';
    renderScoreList();
  }
}

async function renderQuestionList() {
  const level = document.getElementById('manager-level-select').value;
  const questions = await getQuizDataForLevel(level);
  currentManagerQuestions = questions;
  
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
        <button class="btn-primary-sm" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;" onclick="editQuestion(${idx})"><img class="apple-emoji" src="https://emojicdn.elk.sh/✏️" alt="✏️"></button>
        <button class="btn-danger-sm" style="padding: 4px 8px; font-size: 11px;" onclick="deleteQuestion(${q.id})"><img class="apple-emoji" src="https://emojicdn.elk.sh/🗑️" alt="🗑️"></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  cancelEdit();
}

let cachedScores = [];

async function renderScoreList() {
  cachedScores = await getStudentScores();
  const filterInput = document.getElementById('score-filter-input');
  const filterLevel = document.getElementById('score-filter-level');
  if (filterInput) filterInput.value = '';
  if (filterLevel) filterLevel.value = 'all';
  filterScoreTable();
}

function filterScoreTable() {
  const searchVal = document.getElementById('score-filter-input').value.toLowerCase().trim();
  const levelVal = document.getElementById('score-filter-level').value;
  
  const filtered = cachedScores.filter(s => {
    const matchesSearch = s.student_name.toLowerCase().includes(searchVal) || 
                          s.class_name.toLowerCase().includes(searchVal);
    const matchesLevel = levelVal === 'all' || s.level === levelVal;
    return matchesSearch && matchesLevel;
  });
  
  const tbody = document.getElementById('score-table-body');
  tbody.innerHTML = '';
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--muted); padding: 24px;">Tidak ada riwayat skor yang cocok.</td></tr>';
    return;
  }
  
  filtered.forEach((s, idx) => {
    const date = new Date(s.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    const levelName = s.level.toUpperCase();
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${date}</td>
      <td><strong>${escapeHtml(s.student_name)}</strong></td>
      <td><span style="font-weight: 800; color: var(--muted);">${escapeHtml(s.class_name)}</span></td>
      <td><span class="detect-bar-label neutral" style="font-size: 11px; font-weight:800; text-transform: uppercase;">${levelName}</span></td>
      <td><span style="font-weight: 800; color: var(--purple);">${s.score}</span></td>
      <td><span style="font-weight: 800; color: ${s.accuracy >= 80 ? 'var(--green)' : s.accuracy >= 50 ? 'var(--yellow-d)' : 'var(--red-d)'}">${s.accuracy}%</span></td>
      <td>${escapeHtml(s.time_spent)}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function clearAllScoresHistory() {
  if (!confirm("Apakah Anda yakin ingin menghapus seluruh riwayat skor siswa dari database?")) return;
  
  const res = await clearStudentScores();
  if (res.status === 'success') {
    await renderScoreList();
  } else {
    alert("Gagal menghapus riwayat skor: " + res.message);
  }
}

function editQuestion(index) {
  const q = currentManagerQuestions[index];
  
  document.getElementById('edit-question-index').value = index;
  document.getElementById('input-q-text').value = q.question;
  document.getElementById('input-q-left').value = q.left;
  document.getElementById('input-q-right').value = q.right;
  document.getElementById('input-q-correct').value = q.correct;
  
  document.getElementById('form-title-text').textContent = `Edit Pertanyaan #${index + 1}`;
  document.getElementById('form-title-icon').src = 'https://emojicdn.elk.sh/✏️';
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
  
  document.getElementById('form-title-text').textContent = "Tambah Pertanyaan Baru";
  document.getElementById('form-title-icon').src = 'https://emojicdn.elk.sh/➕';
  document.getElementById('btn-cancel-edit').style.display = 'none';
}

async function saveQuestion() {
  const level = document.getElementById('manager-level-select').value;
  
  const qText = document.getElementById('input-q-text').value.trim();
  const qLeft = document.getElementById('input-q-left').value.trim();
  const qRight = document.getElementById('input-q-right').value.trim();
  const qCorrect = document.getElementById('input-q-correct').value;
  const editIndex = parseInt(document.getElementById('edit-question-index').value);
  
  if (!qText || !qLeft || !qRight) {
    alert("Maaf, semua kolom (Teks Pertanyaan, Pilihan Kiri, Pilihan Kanan) wajib diisi!");
    return;
  }
  
  let id = -1;
  if (editIndex !== -1) {
    id = currentManagerQuestions[editIndex].id;
  }
  
  const questionData = {
    id: id,
    question: qText,
    left: qLeft,
    right: qRight,
    correct: qCorrect
  };
  
  const res = await saveQuizDataForLevel(level, questionData);
  if (res.status === 'success') {
    await renderQuestionList();
  } else {
    alert("Gagal menyimpan: " + res.message);
  }
}

async function deleteQuestion(id) {
  if (!confirm("Apakah Anda yakin ingin menghapus pertanyaan ini dari bank soal?")) return;
  
  const res = await deleteQuizData(id);
  if (res.status === 'success') {
    await renderQuestionList();
  } else {
    alert("Gagal menghapus: " + res.message);
  }
}

async function resetQuestionsToDefault() {
  const level = document.getElementById('manager-level-select').value;
  let levelName = "";
  if (level === 'sd') levelName = "Sekolah Dasar (SD)";
  else if (level === 'smp') levelName = "Sekolah Menengah Pertama (SMP)";
  else if (level === 'sma') levelName = "Sekolah Menengah Atas (SMA)";
  else if (level === 'mahasiswa') levelName = "Perguruan Tinggi (Mahasiswa)";
  
  if (!confirm(`Apakah Anda yakin ingin mengatur ulang kategori ${levelName} ke setelan bawaan? Seluruh perubahan kustom Anda pada kategori ini akan hilang.`)) return;
  
  const res = await resetQuizDataForLevel(level);
  if (res.status === 'success') {
    await renderQuestionList();
  } else {
    alert("Gagal menyetel ulang: " + res.message);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Ekspor Riwayat Skor ke CSV (Excel)
async function exportScoresToCSV() {
  const scores = await getStudentScores();
  if (scores.length === 0) {
    alert("Tidak ada data skor yang bisa diekspor.");
    return;
  }
  
  // Gunakan BOM (\uFEFF) agar Excel membaca karakter UTF-8 dengan benar
  let csvContent = "\uFEFF"; 
  csvContent += "No,Tanggal,Nama Siswa,Kelas,Tingkat Kuis,Skor,Akurasi,Waktu Pengerjaan\n";
  
  scores.forEach((s, idx) => {
    const date = new Date(s.created_at).toLocaleString('id-ID').replace(/,/g, '');
    const row = [
      idx + 1,
      `"${date}"`,
      `"${s.student_name.replace(/"/g, '""')}"`,
      `"${s.class_name.replace(/"/g, '""')}"`,
      `"${s.level.toUpperCase()}"`,
      s.score,
      `"${s.accuracy}%"`,
      `"${s.time_spent}"`
    ].join(",");
    csvContent += row + "\n";
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Rekap_Nilai_HandStrike_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Web Audio API Synthesizer untuk SFX Game (Ding, Buzz, Win)
function playSound(type) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'correct') {
      // Suara double-ding ceria untuk jawaban benar
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'wrong') {
      // Suara dengung rendah (buzz) untuk jawaban salah
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.setValueAtTime(110, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'win') {
      // Suara arpeggio melodi kemenangan
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.2, now);
      notes.forEach((freq, idx) => {
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      });
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch (e) {
    console.warn("Web Audio API blocked or not supported:", e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('model-url-input');
  if (input) input.value = DEFAULT_MODEL_URL;
});