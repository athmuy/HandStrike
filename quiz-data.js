/* ═══════════════════════════════════════
   quiz-data.js
   Data pertanyaan kuis HandStrike per tingkat pendidikan
   dan sistem penyimpanan local database (localStorage)
   ═══════════════════════════════════════ */

const DEFAULT_QUIZ_DATA = {
  sd: [
    {
      question: "Berapa hasil dari 5 + 3?",
      left: "8",
      right: "7",
      correct: "left"
    },
    {
      question: "Hewan apa yang bernapas dengan insang?",
      left: "Kucing",
      right: "Ikan",
      correct: "right"
    },
    {
      question: "Warna bendera negara Indonesia adalah...",
      left: "Merah Putih",
      right: "Putih Merah",
      correct: "left"
    },
    {
      question: "Berapa jumlah kaki pada hewan sapi?",
      left: "2",
      right: "4",
      correct: "right"
    },
    {
      question: "Matahari terbit di sebelah mana?",
      left: "Timur",
      right: "Barat",
      correct: "left"
    }
  ],
  smp: [
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
      question: "Candi Borobudur terletak di provinsi apa?",
      left: "Jawa Tengah",
      right: "Yogyakarta",
      correct: "left"
    },
    {
      question: "Zat hijau daun yang berperan dalam fotosintesis disebut...",
      left: "Klorofil",
      right: "Hemoglobin",
      correct: "left"
    },
    {
      question: "Berapa jumlah provinsi di Indonesia saat ini (2024)?",
      left: "34",
      right: "38",
      correct: "right"
    }
  ],
  sma: [
    {
      question: "Planet mana yang paling dekat dengan matahari?",
      left: "Merkurius",
      right: "Venus",
      correct: "left"
    },
    {
      question: "Siapa penemu telepon pertama kali?",
      left: "Alexander Graham Bell",
      right: "Thomas Edison",
      correct: "left"
    },
    {
      question: "Rumus kimia dari senyawa air adalah...",
      left: "CO2",
      right: "H2O",
      correct: "right"
    },
    {
      question: "Siapakah presiden pertama Republik Indonesia?",
      left: "Soekarno",
      right: "Soeharto",
      correct: "left"
    },
    {
      question: "Unsur kimia dengan lambang Au di tabel periodik adalah...",
      left: "Emas",
      right: "Perak",
      correct: "left"
    }
  ],
  mahasiswa: [
    {
      question: "Bahasa pemrograman apa yang digunakan secara native di web browser?",
      left: "Python",
      right: "JavaScript",
      correct: "right"
    },
    {
      question: "Siapakah ilmuwan yang mengemukakan teori relativitas?",
      left: "Albert Einstein",
      right: "Isaac Newton",
      correct: "left"
    },
    {
      question: "Protokol transfer data aman yang digunakan secara luas di web adalah...",
      left: "HTTP",
      right: "HTTPS",
      correct: "right"
    },
    {
      question: "Algoritma pencarian yang membagi data terurut menjadi dua bagian adalah...",
      left: "Binary Search",
      right: "Bubble Sort",
      correct: "left"
    },
    {
      question: "Konsep OOP yang memungkinkan kelas mewarisi sifat kelas lain disebut...",
      left: "Polimorfisme",
      right: "Inheritance",
      correct: "right"
    }
  ]
};

// Global variables for active quiz in app.js
let QUIZ_DATA = [];

// Local storage key prefix
const STORAGE_KEY_PREFIX = "handstrike_quiz_";

// Load data from localStorage or fallback to defaults
function initQuizData() {
  const levels = ["sd", "smp", "sma", "mahasiswa"];
  levels.forEach(level => {
    const key = STORAGE_KEY_PREFIX + level;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(DEFAULT_QUIZ_DATA[level]));
    }
  });
}

function getQuizDataForLevel(level) {
  const key = STORAGE_KEY_PREFIX + level;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : (DEFAULT_QUIZ_DATA[level] || []);
}

function saveQuizDataForLevel(level, data) {
  const key = STORAGE_KEY_PREFIX + level;
  localStorage.setItem(key, JSON.stringify(data));
}

function resetQuizDataForLevel(level) {
  const key = STORAGE_KEY_PREFIX + level;
  localStorage.setItem(key, JSON.stringify(DEFAULT_QUIZ_DATA[level]));
}

// Initial initialization of localStorage
initQuizData();