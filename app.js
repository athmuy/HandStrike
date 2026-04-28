// ================================
// KONFIGURASI
// ================================
const URL = "https://teachablemachine.withgoogle.com/models/rsT6VZXS5/";

const PREDICTION_INTERVAL = 100;
const CONFIDENCE_THRESHOLD = 0.85;
const FILL_DURATION = 1500;

// ================================
// VARIABEL
// ================================
let model, webcam, ctx;
let isModelLoaded = false;

let currentQuestionIndex = 0;
let score = 0;
let predictionLoop;

let fillStartTime = null;
let currentTarget = null;

// ================================
// SCREEN
// ================================
function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(`screen-${name}`).classList.add("active");
}

function skipToGame() {
    showScreen("game");
    loadQuestion(0);
}

// ================================
// LOAD MODEL + CAMERA
// ================================
async function loadModel() {
    try {
        const statusText = document.getElementById("status-text");
        if (statusText) statusText.innerText = "Memuat AI & Kamera...";

        // DEBUG DEVICE
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log("Devices:", devices);

        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";

        model = await tmPose.load(modelURL, metadataURL);

        const size = 400;
        const flip = true;

        webcam = new tmPose.Webcam(size, size, flip);

        await webcam.setup();   // minta izin kamera
        await webcam.play();

        const canvas = document.getElementById("webcam-canvas");
        canvas.width = size;
        canvas.height = size;

        ctx = canvas.getContext("2d");

        isModelLoaded = true;

        if (statusText) statusText.style.display = "none";

        showScreen("game");

        startPredictionLoop();
        loadQuestion(0);

    } catch (e) {
        console.error("ERROR DETAIL:", e);
        alert("Gagal akses kamera / model:\n" + e.message);
    }
}

// ================================
// LOOP AI
// ================================
function startPredictionLoop() {
    if (predictionLoop) clearTimeout(predictionLoop);
    loop();
}

async function loop() {
    if (!isModelLoaded) return;

    webcam.update();

    // DRAW VIDEO
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

// ================================
// BAR
// ================================
function updateBars(predictions) {
    predictions.forEach(p => {
        const label = p.className.toLowerCase();

        const bar = document.getElementById(`bar-${label}`);
        const percent = document.getElementById(`pct-${label}`);

        if (bar && percent) {
            const val = Math.round(p.probability * 100);
            bar.style.width = `${val}%`;
            percent.innerText = `${val}%`;
        }
    });
}

// ================================
// GESTURE
// ================================
function handlePrediction(prediction) {
    const gestureText = document.getElementById("gesture-value");

    if (prediction.probability > CONFIDENCE_THRESHOLD) {
        gestureText.innerText = prediction.className.toUpperCase();

        if (prediction.className.toLowerCase() === "left") {
            startFillingBar("left");
        } else if (prediction.className.toLowerCase() === "right") {
            startFillingBar("right");
        } else {
            resetBars();
        }
    } else {
        gestureText.innerText = "-";
        resetBars();
    }
}

// ================================
// HOLD SYSTEM
// ================================
function startFillingBar(side) {
    if (currentTarget !== side) {
        currentTarget = side;
        fillStartTime = Date.now();
    }

    const elapsed = Date.now() - fillStartTime;
    const progress = Math.min((elapsed / FILL_DURATION) * 100, 100);

    document.getElementById("hold-bar").style.width = `${progress}%`;

    if (progress >= 100) {
        selectAnswer(side);
        resetBars();
    }
}

function resetBars() {
    currentTarget = null;
    fillStartTime = null;
    document.getElementById("hold-bar").style.width = "0%";
}

// ================================
// QUIZ
// ================================
function loadQuestion(index) {
    const q = quizData[index];

    document.getElementById("q-text").innerText = q.question;
    document.getElementById("choice-left-text").innerText = q.options.left;
    document.getElementById("choice-right-text").innerText = q.options.right;

    document.getElementById("q-number").innerText = `Pertanyaan ${index + 1}`;
    document.getElementById("progress-text").innerText = `${index + 1} / ${quizData.length}`;

    const progress = ((index + 1) / quizData.length) * 100;
    document.getElementById("progress-fill").style.width = `${progress}%`;
}

function selectAnswer(side) {
    const currentQuestion = quizData[currentQuestionIndex];

    const selectedAnswer = side === "left"
        ? currentQuestion.options.left
        : currentQuestion.options.right;

    checkAnswer(selectedAnswer);
}

function checkAnswer(selectedAnswer) {
    const currentQuestion = quizData[currentQuestionIndex];

    if (selectedAnswer === currentQuestion.correctAnswer) {
        score += 20;
    }

    document.getElementById("score-display").innerText = score;

    currentQuestionIndex++;

    if (currentQuestionIndex < quizData.length) {
        loadQuestion(currentQuestionIndex);
    } else {
        alert(`Kuis selesai! Skor kamu: ${score}`);
        location.reload();
    }
}
