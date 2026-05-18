const HOLD_DURATION = 1500; 
// ini buat ngatur berapa lama gesture harus ditahan biar kebaca jawabannya

const CONFIDENCE_THRESHOLD = 0.75; 
// ini batas minimal keyakinan ai buat nentuin gesture nya valid apa nggak

const DEFAULT_MODEL_URL = "https://teachablemachine.withgoogle.com/models/rsT6VZXS5/";
// ini link model teachable machine nya


// ==========================
// variabel utama game
// ==========================

let model = null; 
// ini buat nyimpen model ai dari tm

let webcam = null; 
// ini buat nyimpen akses kamera

let isCameraMode = false; 
// buat ngecek game lagi pake kamera atau keyboard

let currentQ = 0; 
// buat nyimpen soal ke berapa sekarang

let score = 0; 
// buat nyimpen skor player

let correctCount = 0; 
// buat ngitung jawaban yang bener

let gameStartTime = null; 
// buat nyimpen waktu mulai game

let currentGesture = null; 
// gesture yang lagi kebaca sekarang

let holdStartTime = null; 
// waktu mulai nahan gesture

let isAnswering = false; 
// biar ga bisa spam jawab

let predictionLoop = null; 
// ini buat loop ai deteksi gesture terus menerus

let classLabels = { left: 'kiri', right: 'kanan', neutral: 'netral' };
// label gesture dari teachable machine


// ==========================
// pindah tampilan screen
// ==========================

function showScreen(id) {

  // hapus active dari semua screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // tampilin screen yang dipilih
  document.getElementById('screen-' + id).classList.add('active');
}


// ==========================
// mode keyboard kalau kamera ga dipake
// ==========================

function skipToGame() {

  isCameraMode = false;
  // matiin mode kamera

  document.querySelector('.cam-panel').style.opacity = '0.5';
  // bikin panel kamera agak redup

  document.querySelector('.cam-panel').style.pointerEvents = 'none';
  // biar panel kamera ga bisa diklik

  showScreen('game');
  // langsung masuk screen game

  loadQuestion(0);
  // load soal pertama

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


// ==========================
// load model tm + buka kamera
// ==========================

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

    const size = 300;

    // ini buat nyambungin ke webcam
    webcam = new window.tmPose.Webcam(size, size, false);

    await webcam.setup();
    // minta izin akses kamera

    await webcam.play();
    // nyalain kamera

    isCameraMode = true;

    // ambil canvas buat nampilin kamera
    const canvas = document.getElementById('webcam-canvas');

    canvas.width  = size;
    canvas.height = size;

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


// ==========================
// update status setup
// ==========================

function setStatus(type, html) {

  const el = document.getElementById('setup-status');

  // ganti class status
  el.className = 'setup-status ' + type;

  // ganti isi text status
  el.innerHTML = html;
}


// ==========================
// countdown sebelum mulai game
// ==========================

function startCountdown() {

  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-num');

  // munculin countdown
  overlay.style.display = 'flex';

  let count = 3;

  numEl.textContent = count;

  const iv = setInterval(() => {

    count--;

    if (count <= 0) {

      clearInterval(iv);

      // ilangin countdown
      overlay.style.display = 'none';

      // masuk ke game
      showScreen('game');

      // load soal pertama
      loadQuestion(0);

      // mulai waktu game
      gameStartTime = Date.now();

      // kalau pake kamera mulai deteksi gesture
      if (isCameraMode) startPredictionLoop();

    } else {

      // reset animasi countdown
      numEl.style.animation = 'none';

      void numEl.offsetWidth;

      // kasih animasi pop
      numEl.style.animation =
        'countPop 0.5s cubic-bezier(0.34,1.56,0.64,1)';

      // update angka countdown
      numEl.textContent = count;
    }

  }, 1000);
}
