/* app.js - Final Fix */
const HOLD_DURATION = 1500;
const CONFIDENCE_THRESHOLD = 0.75;
const DEFAULT_MODEL_URL = "https://teachablemachine.withgoogle.com/models/SoddPQAQH/";

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
let classLabels = { left: 'left', right: 'right', neutral: 'neutral' };

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

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

async function loadModel() {
  let urlInput = document.getElementById('model-url-input').value.trim();
  if (!urlInput) {
    urlInput = DEFAULT_MODEL_URL;
    document.getElementById('model-url-input').value = DEFAULT_MODEL_URL;
  }
  classLabels.left = document.getElementById('label-left').value || 'left';
  classLabels.right = document.getElementById('label-right').value || 'right';
  classLabels.neutral = document.getElementById('label-neutral').value || 'neutral';
  const modelURL = urlInput.endsWith('/') ? urlInput : urlInput + '/';
  setStatus('loading', '<span class="spinner"></span> Memuat model...');
  try {
    model = await tmPose.load(modelURL + 'model.json', modelURL + 'metadata.json');
    setStatus('loading', '<span class="spinner"></span> Membuka kamera...');
    const size = 300;
    webcam = new tmPose.Webcam(size, size, true);
    await webcam.setup();
    await webcam.play();
    if (webcam.video) {
      webcam.video.setAttribute('playsinline', '');
      await webcam.video.play();
      console.log("Video stream aktif");
    }
    isCameraMode = true;
    const canvas = document.getElementById('webcam-canvas');
    canvas.width = size;
    canvas.height = size;
    setStatus('success', '✅ Siap! 3 detik lagi...');
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

async function startPredictionLoop() {
  if (!isCameraMode || !model || !webcam) return;
  const canvas = document.getElementById('webcam-canvas');
  const ctx = canvas.getContext('2d');
  async function loop() {
    if (!isCameraMode || !model || !webcam) return;
    try {
      webcam.update();
      // Perbaikan: pastikan webcam.canvas memiliki data, jika tidak, gunakan video
      let inputCanvas = webcam.canvas;
      if (!inputCanvas || inputCanvas.width === 0) {
        // fallback: buat canvas sementara dari video
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (webcam.video && webcam.video.readyState >= 2) {
          tempCtx.drawImage(webcam.video, 0, 0, tempCanvas.width, tempCanvas.height);
          inputCanvas = tempCanvas;
        } else {
          throw new Error("No video frame");
        }
      }
      const { pose, posenetOutput } = await model.estimatePose(inputCanvas);
      const predictions = await model.predict(posenetOutput);
      // Gambar video ke canvas utama
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (webcam.video && webcam.video.readyState >= 2) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(webcam.video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      if (pose) {
        tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
        tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
      }
      let leftConf = 0, rightConf = 0, neutralConf = 0;
      predictions.forEach(p => {
        const name = p.className.toLowerCase();
        if (name === classLabels.left.toLowerCase()) leftConf = p.probability;
        else if (name === classLabels.right.toLowerCase()) rightConf = p.probability;
        else neutralConf = Math.max(neutralConf, p.probability);
      });
      updateBars(leftConf, rightConf, neutralConf);
      processGesture(leftConf, rightConf);
      predictionLoop = requestAnimationFrame(loop);
    } catch (err) {
      console.error("Prediction error:", err);
      // Jangan hentikan loop, coba lagi
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
  document.getElementById('bar-left').style.width = (l*100)+'%';
  document.getElementById('bar-right').style.width = (r*100)+'%';
  document.getElementById('bar-neutral').style.width = (n*100)+'%';
  document.getElementById('pct-left').innerText = Math.round(l*100)+'%';
  document.getElementById('pct-right').innerText = Math.round(r*100)+'%';
  document.getElementById('pct-neutral').innerText = Math.round(n*100)+'%';
}

function processGesture(leftConf, rightConf) {
  if (isAnswering) return;
  let detected = null;
  if (leftConf > CONFIDENCE_THRESHOLD && leftConf > rightConf) detected = 'left';
  else if (rightConf > CONFIDENCE_THRESHOLD && rightConf > leftConf) detected = 'right';
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
      const progress = Math.min((Date.now() - holdStartTime) / HOLD_DURATION, 1);
      holdBar.style.width = (progress * 100) + '%';
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

function loadQuestion(index) {
  if (index >= QUIZ_DATA.length) return endGame();
  currentQ = index;
  isAnswering = false;
  currentGesture = null;
  holdStartTime = null;
  document.getElementById('hold-bar').style.width = '0%';
  document.getElementById('choice-left').className = 'choice-card left';
  document.getElementById('choice-right').className = 'choice-card right';
  const q = QUIZ_DATA[index];
  document.getElementById('q-number').innerText = 'Pertanyaan ' + (index+1);
  document.getElementById('q-text').innerText = q.question;
  document.getElementById('choice-left-text').innerText = q.left;
  document.getElementById('choice-right-text').innerText = q.right;
  const pct = ((index+1)/QUIZ_DATA.length)*100;
  document.getElementById('progress-fill').style.width = pct+'%';
  document.getElementById('progress-text').innerText = (index+1)+' / '+QUIZ_DATA.length;
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
    document.getElementById('score-display').innerText = score;
  }
  document.getElementById('choice-'+q.correct).classList.add('correct');
  if (!isCorrect) {
    const wrongSide = q.correct === 'left' ? 'right' : 'left';
    document.getElementById('choice-'+wrongSide).classList.add('wrong');
  }
  showFeedback(isCorrect);
  setTimeout(() => {
    hideFeedback();
    loadQuestion(currentQ+1);
    if (isCameraMode) startPredictionLoop();
  }, 1500);
}

function showFeedback(isCorrect) {
  const overlay = document.getElementById('feedback-overlay');
  const bubble = document.getElementById('feedback-bubble');
  bubble.innerText = isCorrect ? '✓' : '✗';
  bubble.className = 'feedback-bubble ' + (isCorrect ? 'correct' : 'wrong');
  overlay.classList.add('show');
}
function hideFeedback() { document.getElementById('feedback-overlay').classList.remove('show'); }

function endGame() {
  stopPredictionLoop();
  if (webcam) webcam.stop();
  document.removeEventListener('keydown', keyboardFallback);
  const total = QUIZ_DATA.length;
  const pct = Math.round((correctCount/total)*100);
  const elapsed = Math.round((Date.now()-gameStartTime)/1000);
  const timeStr = `${Math.floor(elapsed/60)}m ${elapsed%60}s`;
  document.getElementById('result-trophy').innerText = pct>=80 ? '🏆' : (pct>=50 ? '🥈' : '🥉');
  document.getElementById('result-pct').innerText = pct+'%';
  document.getElementById('result-label').innerText = `Benar ${correctCount} dari ${total}`;
  document.getElementById('stat-correct').innerText = correctCount;
  document.getElementById('stat-wrong').innerText = total-correctCount;
  document.getElementById('stat-time').innerText = timeStr;
  showScreen('result');
}

function restartGame() {
  currentQ = 0; score = 0; correctCount = 0; gameStartTime = null;
  currentGesture = null; holdStartTime = null; isAnswering = false;
  document.getElementById('score-display').innerText = '0';
  document.getElementById('hold-bar').style.width = '0%';
  updateBars(0,0,0);
  document.getElementById('gesture-value').innerText = '—';
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
