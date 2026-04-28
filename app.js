/* ═══════════════════════════════════════
   app.js
   Game engine HandStrike dengan Teachable Machine
═══════════════════════════════════════ */

// ── CONFIG ──
const HOLD_DURATION = 1500;
const CONFIDENCE_THRESHOLD = 0.75;
const PREDICTION_INTERVAL = 100;
const DEFAULT_MODEL_URL = "https://teachablemachine.withgoogle.com/models/rsT6VZXS5/";

// ── STATE ──
let model = null;
let webcam = null;
let isModelLoaded = false;
let isCameraMode = false;

let currentQ = 0;
let score = 0;
let correctCount = 0;
let gameStartTime = null;

let currentGesture = null;
let holdStartTime = null;
let isAnswering = false;
let predictionLoop = null;

let classLabels = { left: 'Left', right: 'Right', neutral: 'Neutral' };

// ════════════════════════════════
// SCREEN NAVIGATION
// ════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

// ════════════════════════════════
// SKIP GAME (KEYBOARD MODE)
// ════════════════════════════════
function skipToGame() {
  isCameraMode = false;
  document.querySelector('.cam-panel').style.opacity = '0.5';
  document.querySelector('.cam-panel').style.pointerEvents = 'none';
  showScreen('game');
  loadQuestion(0);
  gameStartTime = Date.now();
  document.addEventListener('keydown', keyboardFallback);
}

function keyboardFallback(e) {
  if (isAnswering) return;
  if (e.key === 'ArrowLeft')  submitAnswer('left');
  if (e.key === 'ArrowRight') submitAnswer('right');
}

// ════════════════════════════════
// MODEL LOADING
// ════════════════════════════════
async function loadModel() {
  let urlInput = document.getElementById('model-url-input').value.trim();
  
  if (!urlInput) {
    urlInput = DEFAULT_MODEL_URL;
    document.getElementById('model-url-input').value = DEFAULT_MODEL_URL;
  }

  classLabels.left    = document.getElementById('label-left').value    || 'Left';
  classLabels.right   = document.getElementById('label-right').value   || 'Right';
  classLabels.neutral = document.getElementById('label-neutral').value || 'Neutral';

  const modelURL = urlInput.endsWith('/') ? urlInput : urlInput + '/';

  setStatus('loading', '<span class="spinner"></span> Memuat model Teachable Machine...');

  try {
    model = await tmPose.load(modelURL + 'model.json', modelURL + 'metadata.json');
    setStatus('loading', '<span class="spinner"></span> Membuka kamera...');

    const size = 300;
    webcam = new tmPose.Webcam(size, size, true);
    await webcam.setup();
    await webcam.play();

    // Pastikan video element berjalan lancar
    if (webcam.video) {
      webcam.video.setAttribute('playsinline', '');
      await webcam.video.play().catch(e => console.warn('Auto-play warning:', e));
    }

    isModelLoaded = true;
    isCameraMode = true;

    const canvas = document.getElementById('webcam-canvas');
    canvas.width = size;
    canvas.height = size;

    setStatus('success', '✅ Model dan kamera siap! Dimulai dalam 3 detik...');

    setTimeout(() => startCountdown(), 800);
  } catch (err) {
    setStatus('error', '❌ Gagal memuat: ' + err.message);
    console.error(err);
  }
}

function setStatus(type, html) {
  const el = document.getElementById('setup-status');
  el.className = 'setup-status ' + type;
  el.innerHTML = html;
}

// ════════════════════════════════
// COUNTDOWN
// ════════════════════════════════
function startCountdown() {
  const overlay = document.getElementById('countdown-overlay');
  const numEl = document.getElementById('countdown-num');
  overlay.style.display = 'flex';
  let count = 3;
  numEl.textContent = count;

  const iv = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(iv);
      overlay.style.display = 'none';
      showScreen('game');
      loadQuestion(0);
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

// ════════════════════════════════
// PREDICTION LOOP (FIXED)
// ════════════════════════════════
async function startPredictionLoop() {
  if (!isCameraMode || !model || !webcam) return;

  const canvas = document.getElementById('webcam-canvas');
  if (!canvas) {
    console.error('Canvas not found!');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Cannot get 2D context!');
    return;
  }

  const size = 300;
  canvas.width = size;
  canvas.height = size;

  async function loop() {
    if (!isCameraMode || !model || !webcam) return;

    try {
      // Update webcam internal frame
      webcam.update();
      
      // Estimate pose dari canvas internal webcam (diperlukan untuk model)
      const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
      const predictions = await model.predict(posenetOutput);

      // Gambar video dari elemen video asli (fix layar hitam)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (webcam.video && webcam.video.readyState >= 2) {
        // Flip horizontal agar mirror preview
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(webcam.video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      } else if (webcam.canvas) {
        // Fallback
        ctx.drawImage(webcam.canvas, 0, 0);
      }

      // Gambar skeleton jika pose terdeteksi
      if (pose) {
        const minPartConfidence = 0.5;
        // Fungsi draw membutuhkan koordinat yang sudah di-flip? Kita gambar setelah flip
        // Karena canvas sudah mirror, kita tetap gambar biasa.
        // Untuk koreksi posisi (karena flip), kita override dengan fungsi manual sederhana
        // Tapi untuk kemudahan kita gunakan fungsi bawaan (diasumsikan tetap sesuai)
        try {
          tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
          tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
        } catch(e) { console.warn("Draw error", e); }
      }

      // Parse predictions
      let leftConf = 0, rightConf = 0, neutralConf = 0;
      predictions.forEach(p => {
        const name = p.className.toLowerCase();
        if (name === classLabels.left.toLowerCase()) {
          leftConf = p.probability;
        } else if (name === classLabels.right.toLowerCase()) {
          rightConf = p.probability;
        } else {
          neutralConf = Math.max(neutralConf, p.probability);
        }
      });

      updateBars(leftConf, rightConf, neutralConf);
      processGesture(leftConf, rightConf);

      predictionLoop = requestAnimationFrame(loop);
    } catch (err) {
      console.error('Prediction error:', err);
      predictionLoop = requestAnimationFrame(loop);
    }
  }

  loop();
}

function stopPredictionLoop() {
  if (predictionLoop) {
    cancelAnimationFrame(predictionLoop);
    predictionLoop = null;
  }
}

function updateBars(l, r, n) {
  document.getElementById('bar-left').style.width = (l * 100) + '%';
  document.getElementById('bar-right').style.width = (r * 100) + '%';
  document.getElementById('bar-neutral').style.width = (n * 100) + '%';
  document.getElementById('pct-left').textContent = Math.round(l * 100) + '%';
  document.getElementById('pct-right').textContent = Math.round(r * 100) + '%';
  document.getElementById('pct-neutral').textContent = Math.round(n * 100) + '%';
}

// ════════════════════════════════
// GESTURE PROCESSING
// ════════════════════════════════
function processGesture(leftConf, rightConf) {
  if (isAnswering) return;

  let detected = null;
  if (leftConf > CONFIDENCE_THRESHOLD && leftConf > rightConf) {
    detected = 'left';
  } else if (rightConf > CONFIDENCE_THRESHOLD && rightConf > leftConf) {
    detected = 'right';
  }

  const gestureEl = document.getElementById('gesture-value');
  const holdBar = document.getElementById('hold-bar');

  if (detected) {
    gestureEl.textContent = detected === 'left' ? '← Kiri' : 'Kanan →';
    gestureEl.className = 'gesture-value ' + detected;

    document.getElementById('choice-left').classList.toggle('active', detected === 'left');
    document.getElementById('choice-right').classList.toggle('active', detected === 'right');

    if (detected !== currentGesture) {
      currentGesture = detected;
      holdStartTime = Date.now();
    } else {
      const elapsed = Date.now() - holdStartTime;
      const progress = Math.min(elapsed / HOLD_DURATION, 1);
      holdBar.style.width = (progress * 100) + '%';
      holdBar.style.background = progress > 0.65
        ? (detected === 'left' ? 'var(--blue)' : 'var(--red)')
        : 'var(--purple)';

      if (progress >= 1) {
        holdBar.style.width = '0%';
        submitAnswer(detected);
      }
    }
  } else {
    gestureEl.textContent = '—';
    gestureEl.className = 'gesture-value neutral';
    currentGesture = null;
    holdStartTime = null;
    holdBar.style.width = '0%';
    document.getElementById('choice-left').classList.remove('active');
    document.getElementById('choice-right').classList.remove('active');
  }
}

// ════════════════════════════════
// QUIZ LOGIC
// ════════════════════════════════
function loadQuestion(index) {
  if (index >= QUIZ_DATA.length) {
    endGame();
    return;
  }

  currentQ = index;
  isAnswering = false;
  currentGesture = null;
  holdStartTime = null;

  document.getElementById('hold-bar').style.width = '0%';
  document.getElementById('choice-left').className = 'choice-card left';
  document.getElementById('choice-right').className = 'choice-card right';

  const q = QUIZ_DATA[index];
  document.getElementById('q-number').textContent = 'Pertanyaan ' + (index + 1);
  document.getElementById('q-text').textContent = q.question;
  document.getElementById('choice-left-text').textContent = q.left;
  document.getElementById('choice-right-text').textContent = q.right;

  const pct = ((index + 1) / QUIZ_DATA.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = (index + 1) + ' / ' + QUIZ_DATA.length;
}

function submitAnswer(side) {
  if (isAnswering) return;
  isAnswering = true;
  stopPredictionLoop();

  const q = QUIZ_DATA[currentQ];
  const isCorrect = side === q.correct;

  if (isCorrect) {
    score += 10;
    correctCount++;
    document.getElementById('score-display').textContent = score;
  }

  document.getElementById('choice-' + q.correct).classList.add('correct');
  const wrongSide = q.correct === 'left' ? 'right' : 'left';
  if (!isCorrect) {
    document.getElementById('choice-' + wrongSide).classList.add('wrong');
  }

  showFeedback(isCorrect);

  setTimeout(() => {
    hideFeedback();
    loadQuestion(currentQ + 1);
    if (isCameraMode) startPredictionLoop();
  }, 1500);
}

function showFeedback(isCorrect) {
  const overlay = document.getElementById('feedback-overlay');
  const bubble = document.getElementById('feedback-bubble');
  bubble.textContent = isCorrect ? '✓' : '✗';
  bubble.className = 'feedback-bubble ' + (isCorrect ? 'correct' : 'wrong');
  overlay.classList.add('show');
}

function hideFeedback() {
  document.getElementById('feedback-overlay').classList.remove('show');
}

function endGame() {
  stopPredictionLoop();
  if (webcam) webcam.stop();
  document.removeEventListener('keydown', keyboardFallback);

  const total = QUIZ_DATA.length;
  const pct = Math.round((correctCount / total) * 100);
  const elapsed = Math.round((Date.now() - gameStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = (mins > 0 ? mins + 'm ' : '') + secs + 's';

  const trophy = pct >= 80 ? '🏆' : pct >= 50 ? '🥈' : '🥉';
  const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)';

  document.getElementById('result-trophy').textContent = trophy;
  document.getElementById('result-pct').textContent = pct + '%';
  document.getElementById('result-pct').style.color = color;
  document.getElementById('result-label').textContent = 'Benar ' + correctCount + ' dari ' + total + ' pertanyaan';
  document.getElementById('stat-correct').textContent = correctCount;
  document.getElementById('stat-wrong').textContent = total - correctCount;
  document.getElementById('stat-time').textContent = timeStr;

  showScreen('result');
}

function restartGame() {
  currentQ = 0;
  score = 0;
  correctCount = 0;
  gameStartTime = null;
  currentGesture = null;
  holdStartTime = null;
  isAnswering = false;

  document.getElementById('score-display').textContent = '0';
  document.getElementById('hold-bar').style.width = '0%';
  updateBars(0, 0, 0);
  document.getElementById('gesture-value').textContent = '—';
  document.getElementById('gesture-value').className = 'gesture-value neutral';

  showScreen('game');
  loadQuestion(0);
  gameStartTime = Date.now();

  if (isCameraMode && webcam) {
    webcam.play();
    startPredictionLoop();
  } else {
    document.addEventListener('keydown', keyboardFallback);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('model-url-input');
  if (input) {
    input.value = DEFAULT_MODEL_URL;
  }
});
