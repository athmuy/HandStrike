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
  showScreen('game');
  loadQuestion(0);
  gameStartTime = Date.now();
  document.addEventListener('keydown', keyboardFallback);
}

function keyboardFallback(e) {
  if (isAnswering) return;
  if (e.key === 'ArrowLeft') submitAnswer('left');
  if (e.key === 'ArrowRight') submitAnswer('right');
}

// Load model & camera
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

    const size = 300;
    // flip=false — kita akan flip sendiri di canvas agar bebas dari bug webcam.canvas
    webcam = new window.tmPose.Webcam(size, size, false);
    await webcam.setup();
    await webcam.play();

    isCameraMode = true;
    const canvas = document.getElementById('webcam-canvas');
    canvas.width  = size;
    canvas.height = size;

    setStatus('success', '✅ Model & kamera siap! 3 detik lagi...');
    setTimeout(() => startCountdown(), 800);
  } catch (err) {
    setStatus('error', '❌ Gagal: ' + err.message);
    console.error(err);
  }
}

function setStatus(type, html) {
  const el = document.getElementById('setup-status');
  el.className = 'setup-status ' + type;
  el.innerHTML = html;
}

function startCountdown() {
  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-num');
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

async function startPredictionLoop() {
  if (!isCameraMode || !model || !webcam) return;

  const canvas = document.getElementById('webcam-canvas');
  const ctx    = canvas.getContext('2d');
  if (!ctx) return;

  async function loop() {
    if (!isCameraMode || !model || !webcam) return;

    try {
      webcam.update(); // update internal webcam.canvas untuk estimatePose

      // Estimasi pose dari webcam.canvas (wajib, ini yang model pakai)
      const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
      const predictions = await model.predict(posenetOutput);

      // ── Gambar video ke canvas kita ──────────────────────────────
      // Gunakan webcam.video langsung agar tidak bergantung pada
      // webcam.canvas yang kadang kosong di beberapa environment.
      // Flip mirror dilakukan manual dengan ctx.translate + ctx.scale.
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const vid = webcam.video;
      if (vid && vid.readyState >= 2) {
        ctx.save();
        ctx.translate(canvas.width, 0); // geser ke kanan
        ctx.scale(-1, 1);               // flip horizontal
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // ── Overlay skeleton pose ────────────────────────────────────
      if (pose) {
        try {
          window.tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
          window.tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
        } catch(e) {}
      }

      // ── Parse prediksi ───────────────────────────────────────────
      let leftConf = 0, rightConf = 0, neutralConf = 0;
      predictions.forEach(p => {
        const name = p.className.toLowerCase();
        if      (name === classLabels.left.toLowerCase())  leftConf    = p.probability;
        else if (name === classLabels.right.toLowerCase()) rightConf   = p.probability;
        else    neutralConf = Math.max(neutralConf, p.probability);
      });

      updateBars(leftConf, rightConf, neutralConf);
      processGesture(leftConf, rightConf);

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
  stopPredictionLoop();
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
    loadQuestion(currentQ + 1);
    if (isCameraMode) startPredictionLoop();
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

function endGame() {
  stopPredictionLoop();
  if (webcam) webcam.stop();
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
  document.getElementById('score-display').textContent = '0';
  document.getElementById('hold-bar').style.width = '0%';
  updateBars(0, 0, 0);
  document.getElementById('gesture-value').textContent = '—';
  showScreen('game');
  loadQuestion(0);
  gameStartTime = Date.now();
  if (isCameraMode && webcam) { webcam.play(); startPredictionLoop(); }
  else document.addEventListener('keydown', keyboardFallback);
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('model-url-input');
  if (input) input.value = DEFAULT_MODEL_URL;
});
