// GANTI LINK INI dengan link model Teachable Machine terbarumu
const URL = "https://teachablemachine.withgoogle.com/models/rsT6VZXS5/";

let model, webcam, ctx, maxPredictions;
let isModelLoaded = false;
let currentQuestionIndex = 0;
let score = 0;
let predictionLoop;

const PREDICTION_INTERVAL = 100; 
const CONFIDENCE_THRESHOLD = 0.85;
const FILL_DURATION = 1500; 

let fillStartTime = null;
let currentTarget = null; 

async function loadModel() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    try {
        const statusText = document.getElementById('status-text');
        if (statusText) statusText.innerText = "Memuat AI & Kamera...";

        model = await tmPose.load(modelURL, metadataURL);
        
        const size = 400;
        const flip = true;
        webcam = new tmPose.Webcam(size, size, flip);

        await webcam.setup(); // ⬅️ ini sekarang dipanggil setelah klik
        await webcam.play();

        const canvas = document.getElementById('webcam-canvas');
        canvas.width = size;
        canvas.height = size;
        ctx = canvas.getContext('2d');

        isModelLoaded = true;

        if (statusText) statusText.style.display = "none";

        startPredictionLoop();
        loadQuestion(0);

    } catch (e) {
        console.error("ERROR DETAIL:", e);
        alert("Gagal akses kamera: " + e.message);
    }
}

function startPredictionLoop() {
    if (predictionLoop) clearTimeout(predictionLoop);
    loop();
}

async function loop() {
    if (!isModelLoaded) return;

    webcam.update(); 

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(webcam.canvas, 0, 0);

    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const predictions = await model.predict(posenetOutput);

    if (pose) {
        tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
        tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
    }

    const topPrediction = [...predictions].sort((a, b) => b.probability - a.probability)[0];

    updateBars(predictions);
    handlePrediction(topPrediction);

    predictionLoop = setTimeout(loop, PREDICTION_INTERVAL);
}

function updateBars(predictions) {
    predictions.forEach(p => {
        const label = p.className.toLowerCase();
        const bar = document.getElementById(`bar-${label}`);
        const percent = document.getElementById(`percent-${label}`);
        if (bar && percent) {
            const val = Math.round(p.probability * 100);
            bar.style.width = `${val}%`;
            percent.innerText = `${val}%`;
        }
    });
}

function handlePrediction(prediction) {
    const gestureText = document.getElementById('detected-gesture');

    if (prediction.probability > CONFIDENCE_THRESHOLD) {
        gestureText.innerText = prediction.className.toUpperCase();

        if (prediction.className === 'kanan') startFillingBar('right');
        else if (prediction.className === 'kiri') startFillingBar('left');
        else resetBars();

    } else {
        gestureText.innerText = "-";
        resetBars();
    }
}

function startFillingBar(side) {
    if (currentTarget !== side) {
        currentTarget = side;
        fillStartTime = Date.now();
    }

    const elapsed = Date.now() - fillStartTime;
    const progress = Math.min((elapsed / FILL_DURATION) * 100, 100);

    document.getElementById('answer-progress-bar').style.width = `${progress}%`;

    if (progress >= 100) {
        checkAnswer(side === 'left' ? 'Jakarta' : 'Surabaya');
        resetBars();
    }
}

function resetBars() {
    currentTarget = null;
    fillStartTime = null;
    document.getElementById('answer-progress-bar').style.width = `0%`;
}

/* ===================== QUIZ ===================== */

function loadQuestion(index) {
    const q = quizData[index];

    document.getElementById('question-text').innerText = q.question;
    document.getElementById('option-left').innerText = q.options.left;
    document.getElementById('option-right').innerText = q.options.right;
    document.getElementById('current-question-num').innerText = index + 1;
}

function checkAnswer(selectedAnswer) {
    const currentQuestion = quizData[currentQuestionIndex];

    if (selectedAnswer === currentQuestion.correctAnswer) {
        score += 20;
        document.getElementById('score-display').innerText = `${score} poin`;
    }

    currentQuestionIndex++;

    if (currentQuestionIndex < quizData.length) {
        loadQuestion(currentQuestionIndex);

        const progress = ((currentQuestionIndex) / quizData.length) * 100;
        document.querySelector('.quiz-progress-fill').style.width = `${progress}%`;

    } else {
        alert(`Kuis Selesai! Skor akhir kamu: ${score}`);
        location.reload();
    }
}

/* ===================== START BUTTON ===================== */

// WAJIB: trigger dari user
document.getElementById("start-btn").addEventListener("click", loadModel);
