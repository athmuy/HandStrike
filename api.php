<?php
/* ═══════════════════════════════════════
   api.php
   Backend API untuk Kuis HandStrike
   Menghubungkan ke database MySQL
   ═══════════════════════════════════════ */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

// Jika preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Konfigurasi Database (Deteksi Otomatis Lokal / Online)
if ($_SERVER['HTTP_HOST'] === 'localhost' || $_SERVER['HTTP_HOST'] === '127.0.0.1' || stripos($_SERVER['HTTP_HOST'], 'localhost:') === 0) {
    $db_host = 'localhost';
    $db_name = 'handstrike';
    $db_user = 'root';
    $db_pass = ''; // default XAMPP kosong
} else {
    $db_host = 'sql202.infinityfree.com';
    $db_name = 'if0_42129414_handstrike';
    $db_user = 'if0_42129414';
    $db_pass = 'PASSWORD_DATABASE_ANDA'; // Ganti dengan Password Akun / MySQL dari dashboard InfinityFree
}

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Gagal koneksi ke database: ' . $e->getMessage()
    ]);
    exit();
}

// Default data untuk seeding & reset
$default_questions = [
  'sd' => [
    ['question' => 'Berapa hasil dari 5 + 3?', 'left_option' => '8', 'right_option' => '7', 'correct_option' => 'left'],
    ['question' => 'Hewan apa yang bernapas dengan insang?', 'left_option' => 'Kucing', 'right_option' => 'Ikan', 'correct_option' => 'right'],
    ['question' => 'Warna bendera negara Indonesia adalah...', 'left_option' => 'Merah Putih', 'right_option' => 'Putih Merah', 'correct_option' => 'left'],
    ['question' => 'Berapa jumlah kaki pada hewan sapi?', 'left_option' => '2', 'right_option' => '4', 'correct_option' => 'right'],
    ['question' => 'Matahari terbit di sebelah mana?', 'left_option' => 'Timur', 'right_option' => 'Barat', 'correct_option' => 'left']
  ],
  'smp' => [
    ['question' => 'Mana yang merupakan ibu kota Indonesia?', 'left_option' => 'Jakarta', 'right_option' => 'Surabaya', 'correct_option' => 'left'],
    ['question' => 'Berapa hasil dari 7 × 8?', 'left_option' => '54', 'right_option' => '56', 'correct_option' => 'right'],
    ['question' => 'Candi Borobudur terletak di provinsi apa?', 'left_option' => 'Jawa Tengah', 'right_option' => 'Yogyakarta', 'correct_option' => 'left'],
    ['question' => 'Zat hijau daun yang berperan dalam fotosintesis disebut...', 'left_option' => 'Klorofil', 'right_option' => 'Hemoglobin', 'correct_option' => 'left'],
    ['question' => 'Berapa jumlah provinsi di Indonesia saat ini (2024)?', 'left_option' => '34', 'right_option' => '38', 'correct_option' => 'right']
  ],
  'sma' => [
    ['question' => 'Planet mana yang paling dekat dengan matahari?', 'left_option' => 'Merkurius', 'right_option' => 'Venus', 'correct_option' => 'left'],
    ['question' => 'Siapa penemu telepon pertama kali?', 'left_option' => 'Alexander Graham Bell', 'right_option' => 'Thomas Edison', 'correct_option' => 'left'],
    ['question' => 'Rumus kimia dari senyawa air adalah...', 'left_option' => 'CO2', 'right_option' => 'H2O', 'correct_option' => 'right'],
    ['question' => 'Siapakah presiden pertama Republik Indonesia?', 'left_option' => 'Soekarno', 'right_option' => 'Soeharto', 'correct_option' => 'left'],
    ['question' => 'Unsur kimia dengan lambang Au di tabel periodik adalah...', 'left_option' => 'Emas', 'right_option' => 'Perak', 'correct_option' => 'left']
  ],
  'mahasiswa' => [
    ['question' => 'Bahasa pemrograman apa yang digunakan secara native di web browser?', 'left_option' => 'Python', 'right_option' => 'JavaScript', 'correct_option' => 'right'],
    ['question' => 'Siapakah ilmuwan yang mengemukakan teori relativitas?', 'left_option' => 'Albert Einstein', 'right_option' => 'Isaac Newton', 'correct_option' => 'left'],
    ['question' => 'Protokol transfer data aman yang digunakan secara luas di web adalah...', 'left_option' => 'HTTP', 'right_option' => 'HTTPS', 'correct_option' => 'right'],
    ['question' => 'Algoritma pencarian yang membagi data terurut menjadi dua bagian adalah...', 'left_option' => 'Binary Search', 'right_option' => 'Bubble Sort', 'correct_option' => 'left'],
    ['question' => 'Konsep OOP yang memungkinkan kelas mewarisi sifat kelas lain disebut...', 'left_option' => 'Polimorfisme', 'right_option' => 'Inheritance', 'correct_option' => 'right']
  ]
];

// Dapatkan method dan query action
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Decode JSON input body untuk POST request
$input = json_decode(file_get_contents('php://input'), true);

switch ($action) {
    case 'get':
        $level = isset($_GET['level']) ? $_GET['level'] : 'smp';
        try {
            $stmt = $pdo->prepare("SELECT * FROM questions WHERE level = :level ORDER BY id ASC");
            $stmt->execute(['level' => $level]);
            $rows = $stmt->fetchAll();
            
            // Format ulang ke format yang diinginkan frontend
            $questions = [];
            foreach ($rows as $row) {
                $questions[] = [
                    'id' => (int)$row['id'],
                    'question' => $row['question'],
                    'left' => $row['left_option'],
                    'right' => $row['right_option'],
                    'correct' => $row['correct_option']
                ];
            }
            
            echo json_encode([
                'status' => 'success',
                'data' => $questions
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'save':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
            break;
        }

        $id = isset($input['id']) ? (int)$input['id'] : -1;
        $level = isset($input['level']) ? $input['level'] : '';
        $question = isset($input['question']) ? $input['question'] : '';
        $left = isset($input['left']) ? $input['left'] : '';
        $right = isset($input['right']) ? $input['right'] : '';
        $correct = isset($input['correct']) ? $input['correct'] : 'left';

        if (empty($level) || empty($question) || empty($left) || empty($right)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Semua kolom wajib diisi!']);
            break;
        }

        try {
            if ($id > 0) {
                // UPDATE
                $stmt = $pdo->prepare("UPDATE questions SET question = :question, left_option = :left, right_option = :right, correct_option = :correct WHERE id = :id");
                $stmt->execute([
                    'question' => $question,
                    'left' => $left,
                    'right' => $right,
                    'correct' => $correct,
                    'id' => $id
                ]);
                $message = 'Pertanyaan berhasil diubah!';
            } else {
                // INSERT
                $stmt = $pdo->prepare("INSERT INTO questions (level, question, left_option, right_option, correct_option) VALUES (:level, :question, :left, :right, :correct)");
                $stmt->execute([
                    'level' => $level,
                    'question' => $question,
                    'left' => $left,
                    'right' => $right,
                    'correct' => $correct
                ]);
                $id = (int)$pdo->lastInsertId();
                $message = 'Pertanyaan baru berhasil ditambahkan!';
            }

            echo json_encode([
                'status' => 'success',
                'message' => $message,
                'data' => [
                    'id' => $id,
                    'level' => $level,
                    'question' => $question,
                    'left' => $left,
                    'right' => $right,
                    'correct' => $correct
                ]
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'delete':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
            break;
        }

        $id = isset($input['id']) ? (int)$input['id'] : -1;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'ID pertanyaan tidak valid!']);
            break;
        }

        try {
            $stmt = $pdo->prepare("DELETE FROM questions WHERE id = :id");
            $stmt->execute(['id' => $id]);
            
            echo json_encode([
                'status' => 'success',
                'message' => 'Pertanyaan berhasil dihapus!'
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'reset':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
            break;
        }

        $level = isset($input['level']) ? $input['level'] : '';
        if (empty($level) || !isset($default_questions[$level])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Level tidak valid!']);
            break;
        }

        try {
            // Mulai transaksi
            $pdo->beginTransaction();

            // Hapus pertanyaan level yang dipilih
            $stmt = $pdo->prepare("DELETE FROM questions WHERE level = :level");
            $stmt->execute(['level' => $level]);

            // Seeding ulang data bawaan
            $stmt = $pdo->prepare("INSERT INTO questions (level, question, left_option, right_option, correct_option) VALUES (:level, :question, :left, :right, :correct)");
            foreach ($default_questions[$level] as $q) {
                $stmt->execute([
                    'level' => $level,
                    'question' => $q['question'],
                    'left' => $q['left_option'],
                    'right' => $q['right_option'],
                    'correct' => $q['correct_option']
                ]);
            }

            // Commit transaksi
            $pdo->commit();

            echo json_encode([
                'status' => 'success',
                'message' => 'Kategori berhasil disetel ulang ke setelan awal!'
            ]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'save_score':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
            break;
        }

        $student_name = isset($input['student_name']) ? trim($input['student_name']) : '';
        $class_name = isset($input['class_name']) ? trim($input['class_name']) : '';
        $level = isset($input['level']) ? $input['level'] : '';
        $score = isset($input['score']) ? (int)$input['score'] : 0;
        $accuracy = isset($input['accuracy']) ? (int)$input['accuracy'] : 0;
        $time_spent = isset($input['time_spent']) ? $input['time_spent'] : '';

        if (empty($student_name) || empty($class_name) || empty($level) || empty($time_spent)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Nama siswa, kelas, dan data skor tidak lengkap!']);
            break;
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO scores (student_name, class_name, level, score, accuracy, time_spent) VALUES (:name, :class, :level, :score, :accuracy, :time)");
            $stmt->execute([
                'name' => $student_name,
                'class' => $class_name,
                'level' => $level,
                'score' => $score,
                'accuracy' => $accuracy,
                'time' => $time_spent
            ]);

            echo json_encode([
                'status' => 'success',
                'message' => 'Skor berhasil disimpan!'
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'get_scores':
        try {
            $stmt = $pdo->query("SELECT * FROM scores ORDER BY id DESC");
            $rows = $stmt->fetchAll();
            
            $scores = [];
            foreach ($rows as $row) {
                $scores[] = [
                    'id' => (int)$row['id'],
                    'student_name' => $row['student_name'],
                    'class_name' => $row['class_name'],
                    'level' => $row['level'],
                    'score' => (int)$row['score'],
                    'accuracy' => (int)$row['accuracy'],
                    'time_spent' => $row['time_spent'],
                    'created_at' => $row['created_at']
                ];
            }
            
            echo json_encode([
                'status' => 'success',
                'data' => $scores
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'clear_scores':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
            break;
        }

        try {
            $pdo->exec("TRUNCATE TABLE scores");
            echo json_encode([
                'status' => 'success',
                'message' => 'Semua riwayat skor berhasil dihapus!'
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    default:
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'Endpoint tidak ditemukan!'
        ]);
        break;
}
