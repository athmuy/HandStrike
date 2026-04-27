// ═══════════════════════════════════════════════════════════
//                    QUIZ DATA
// ═══════════════════════════════════════════════════════════
const QUIZ_DATA = [
  {
    question: "Mana yang merupakan ibu kota Indonesia?",
    left: "Jakarta",
    right: "Surabaya",
    correct: "left"
  },
  {
    question: "Berapa hasil dari 7 × 8?",
    left: "54",
    right: "56",
    correct: "right"
  },
  {
    question: "Planet mana yang paling dekat dengan matahari?",
    left: "Merkurius",
    right: "Venus",
    correct: "left"
  },
  {
    question: "Siapa penemu telepon?",
    left: "Alexander Graham Bell",
    right: "Thomas Edison",
    correct: "left"
  },
  {
    question: "Bahasa pemrograman apa yang digunakan di web browser?",
    left: "Python",
    right: "JavaScript",
    correct: "right"
  },
];

// ═══════════════════════════════════════════════════════════
//                    CONSTANTS & STATE
// ═══════════════════════════════════════════════════════════
const DEFAULT_MODEL_URL = 'https://teachablemachine.withgoogle.com/models/I_s0V5eAu/';
const HOLD_DURATION = 1500;
const CONFIDENCE_THRESHOLD = 0.75;
const PREDICTION_INTERVAL = 100;

let model = null, webcam = null;
let isModelLoaded = false, isCameraMode = false;
let currentQ = 0, score = 0, correctCount = 0, gameStartTime = null;
let currentGesture = null, holdStartTime = null;
let isAnswering = false, predictionLoop = null;
let classLabels = { left: 'Left', right: 'Right', neutral: 'Neutral' };

// ═══════════════════════════════════════════════════════════
//                    SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function toggleCustomModel() {
  const section = document.getElementById('custom-model-section');
  const btn = document.getElementById('custom-btn');
  
  if (section.classList.contains('show')) {
    section.classList.remove('show');
    btn.textContent = '⚙️ Gunakan Model Custom';
  } else {
    section.classList.add('show');
    btn.textContent = '✓ Gunakan Default';
  }
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
  if (e.key === 'ArrowLeft')  submitAnswer('left');
  if (e.key === 'ArrowRight') submitAnswer('right');
}

// ═══════════════════════════════════════════════════════════
//                    MODEL & CAMERA SETUP
// ═══════════════════════════════════════════════════════════
async function loadModel() {
  // Gunakan URL custom jika ada, atau default
  const urlInput = document.getElementById('model-url-input').value.trim();
  const modelURL = urlInput || DEFAULT_MODEL_URL;
  
  if (!modelURL) { 
    setStatus('error', '⚠️ URL model tidak boleh kosong!'); 
    return; 
  }

  classLabels.left    = document.getElementById('label-left').value    || 'Left';
  classLabels.right   = document.getElementById('label-right').value   || 'Right';
  classLabels.neutral = document.getElementById('label-neutral').value || 'Neutral';

  const finalModelURL = modelURL.endsWith('/') ? modelURL : modelURL + '/';
  setStatus('loading', '<span class="spinner"></span> Memuat model...');

  try {
    model = await tmPose.load(finalModelURL + 'model.json', finalModelURL + 'metadata.json');
    setStatus('loading', '<span class="spinner"></span> Membuka kamera...');

    const size = 300;
    webcam = new tmPose.Webcam(size, size, true);
    await webcam.setup();
    await webcam.play();
    isModelLoaded = true;
    isCameraMode  = true;
    setStatus('success', '✅ Model dan kamera siap!');

    const canvas = document.getElementById('webcam-canvas');
    canvas.width = size; 
    canvas.height = size;
    setTimeout(() => startCountdown(), 800);
  } catch (err) {
    setStatus('error', '❌ Gagal: ' + err.message);
  }
}

function setStatus(type, html) {
  const el = document.getElementById('setup-status');
  el.className = 'setup-status ' + type;
  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
//                    COUNTDOWN & PREDICTION
// ═══════════════════════════════════════════════════════════
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
  const ctx = canvas.getContext('2d');

  async function loop() {
    webcam.update();
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const predictions = await model.predict(posenetOutput);
    ctx.drawImage(webcam.canvas, 0, 0);
    if (pose) tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);

    let leftConf = 0, rightConf = 0, neutralConf = 0;
    predictions.forEach(p => {
      const n = p.className.toLowerCase();
      if      (n === classLabels.left.toLowerCase())  leftConf    = p.probability;
      else if (n === classLabels.right.toLowerCase()) rightConf   = p.probability;
      else                                            neutralConf = Math.max(neutralConf, p.probability);
    });

    updateBars(leftConf, rightConf, neutralConf);
    processGesture(leftConf, rightConf);
    predictionLoop = setTimeout(loop, PREDICTION_INTERVAL);
  }
  loop();
}

function stopPredictionLoop() {
  if (predictionLoop) { 
    clearTimeout(predictionLoop); 
    predictionLoop = null; 
  }
}

// ═══════════════════════════════════════════════════════════
//                    GESTURE DETECTION
// ═══════════════════════════════════════════════════════════
function updateBars(l, r, n) {
  document.getElementById('bar-left').style.width    = (l*100)+'%';
  document.getElementById('bar-right').style.width   = (r*100)+'%';
  document.getElementById('bar-neutral').style.width = (n*100)+'%';
  document.getElementById('pct-left').textContent    = Math.round(l*100)+'%';
  document.getElementById('pct-right').textContent   = Math.round(r*100)+'%';
  document.getElementById('pct-neutral').textContent = Math.round(n*100)+'%';
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
      holdBar.style.width      = (progress * 100) + '%';
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
    gestureEl.className   = 'gesture-value neutral';
    currentGesture = null; 
    holdStartTime = null;
    holdBar.style.width = '0%';
    document.getElementById('choice-left').classList.remove('active');
    document.getElementById('choice-right').classList.remove('active');
  }
}

// ═══════════════════════════════════════════════════════════
//                    QUIZ LOGIC
// ═══════════════════════════════════════════════════════════
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

  const q = QUIZ_DATA[currentQ];
  const isCorrect = side === q.correct;

  if (isCorrect) {
    score += 10; 
    correctCount++;
    document.getElementById('score-display').textContent = score;
  }

  document.getElementById('choice-' + q.correct).classList.add('correct');
  const wrongSide = q.correct === 'left' ? 'right' : 'left';
  if (!isCorrect) document.getElementById('choice-' + wrongSide).classList.add('wrong');

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

function hideFeedback() {
  document.getElementById('feedback-overlay').classList.remove('show');
}

// ═══════════════════════════════════════════════════════════
//                    GAME END & RESTART
// ═══════════════════════════════════════════════════════════
function endGame() {
  stopPredictionLoop();
  if (webcam) webcam.stop();
  document.removeEventListener('keydown', keyboardFallback);

  const total   = QUIZ_DATA.length;
  const pct     = Math.round((correctCount / total) * 100);
  const elapsed = Math.round((Date.now() - gameStartTime) / 1000);
  const mins    = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;

  const trophy = pct >= 80 ? '🏆' : pct >= 50 ? '🥈' : '🥉';
  document.getElementById('result-trophy').textContent   = trophy;
  document.getElementById('result-pct').textContent      = pct + '%';
  document.getElementById('result-pct').style.color      = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)';
  document.getElementById('result-label').textContent    = 'Benar ' + correctCount + ' dari ' + total + ' pertanyaan';
  document.getElementById('stat-correct').textContent    = correctCount;
  document.getElementById('stat-wrong').textContent      = total - correctCount;
  document.getElementById('stat-time').textContent       = (mins > 0 ? mins + 'm ' : '') + secs + 's';

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
  document.getElementById('gesture-value').className   = 'gesture-value neutral';

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
