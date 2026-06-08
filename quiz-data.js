/* ═══════════════════════════════════════
   quiz-data.js
   Menghubungkan frontend ke Backend API (api.php)
   untuk mengambil & menyimpan soal dari MySQL
   ═══════════════════════════════════════ */

const API_URL = "api.php";

// Variabel global untuk menyimpan data kuis aktif
let QUIZ_DATA = [];

// Mengambil data soal dari database MySQL via api.php
async function getQuizDataForLevel(level) {
  try {
    const res = await fetch(`${API_URL}?action=get&level=${level}`);
    if (!res.ok) throw new Error("Gagal mengambil data dari server");
    
    const json = await res.json();
    if (json.status === 'success') {
      return json.data;
    } else {
      console.error("API error:", json.message);
      return [];
    }
  } catch (err) {
    console.error("Gagal memuat bank soal dari MySQL:", err);
    return [];
  }
}

// Menyimpan (Menambah baru atau Mengedit) pertanyaan ke MySQL via api.php
async function saveQuizDataForLevel(level, questionData) {
  try {
    const res = await fetch(`${API_URL}?action=save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        level: level,
        ...questionData
      })
    });
    
    if (!res.ok) throw new Error("Gagal menyimpan data ke server");
    return await res.json();
  } catch (err) {
    console.error("Gagal menyimpan pertanyaan ke MySQL:", err);
    return { status: "error", message: err.message };
  }
}

// Menghapus pertanyaan dari MySQL berdasarkan ID database via api.php
async function deleteQuizData(id) {
  try {
    const res = await fetch(`${API_URL}?action=delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: id })
    });
    
    if (!res.ok) throw new Error("Gagal menghapus data di server");
    return await res.json();
  } catch (err) {
    console.error("Gagal menghapus pertanyaan dari MySQL:", err);
    return { status: "error", message: err.message };
  }
}

// Mengatur ulang (reset) bank soal level tertentu ke setelan bawaan via api.php
async function resetQuizDataForLevel(level) {
  try {
    const res = await fetch(`${API_URL}?action=reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ level: level })
    });
    
    if (!res.ok) throw new Error("Gagal mengatur ulang data di server");
    return await res.json();
  } catch (err) {
    console.error("Gagal reset bank soal di MySQL:", err);
    return { status: "error", message: err.message };
  }
}