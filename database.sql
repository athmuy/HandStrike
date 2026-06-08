-- ═══════════════════════════════════════
-- database.sql
-- Skema database MySQL untuk HandStrike
-- ═══════════════════════════════════════

-- Buat database jika belum ada
CREATE DATABASE IF NOT EXISTS `handstrike` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `handstrike`;

-- --------------------------------------------------------

--
-- Struktur dari tabel `questions`
--

DROP TABLE IF EXISTS `questions`;
CREATE TABLE `questions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `level` VARCHAR(20) NOT NULL,
  `question` TEXT NOT NULL,
  `left_option` VARCHAR(255) NOT NULL,
  `right_option` VARCHAR(255) NOT NULL,
  `correct_option` ENUM('left', 'right') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data untuk tabel `questions`
--

INSERT INTO `questions` (`level`, `question`, `left_option`, `right_option`, `correct_option`) VALUES
-- SD (Sekolah Dasar)
('sd', 'Berapa hasil dari 5 + 3?', '8', '7', 'left'),
('sd', 'Hewan apa yang bernapas dengan insang?', 'Kucing', 'Ikan', 'right'),
('sd', 'Warna bendera negara Indonesia adalah...', 'Merah Putih', 'Putih Merah', 'left'),
('sd', 'Berapa jumlah kaki pada hewan sapi?', '2', '4', 'right'),
('sd', 'Matahari terbit di sebelah mana?', 'Timur', 'Barat', 'left'),

-- SMP (Sekolah Menengah Pertama)
('smp', 'Mana yang merupakan ibu kota Indonesia?', 'Jakarta', 'Surabaya', 'left'),
('smp', 'Berapa hasil dari 7 × 8?', '54', '56', 'right'),
('smp', 'Candi Borobudur terletak di provinsi apa?', 'Jawa Tengah', 'Yogyakarta', 'left'),
('smp', 'Zat hijau daun yang berperan dalam fotosintesis disebut...', 'Klorofil', 'Hemoglobin', 'left'),
('smp', 'Berapa jumlah provinsi di Indonesia saat ini (2024)?', '34', '38', 'right'),

-- SMA (Sekolah Menengah Atas)
('sma', 'Planet mana yang paling dekat dengan matahari?', 'Merkurius', 'Venus', 'left'),
('sma', 'Siapa penemu telepon pertama kali?', 'Alexander Graham Bell', 'Thomas Edison', 'left'),
('sma', 'Rumus kimia dari senyawa air adalah...', 'CO2', 'H2O', 'right'),
('sma', 'Siapakah presiden pertama Republik Indonesia?', 'Soekarno', 'Soeharto', 'left'),
('sma', 'Unsur kimia dengan lambang Au di tabel periodik adalah...', 'Emas', 'Perak', 'left'),

-- Mahasiswa (Perguruan Tinggi)
('mahasiswa', 'Bahasa pemrograman apa yang digunakan secara native di web browser?', 'Python', 'JavaScript', 'right'),
('mahasiswa', 'Siapakah ilmuwan yang mengemukakan teori relativitas?', 'Albert Einstein', 'Isaac Newton', 'left'),
('mahasiswa', 'Protokol transfer data aman yang digunakan secara luas di web adalah...', 'HTTP', 'HTTPS', 'right'),
('mahasiswa', 'Algoritma pencarian yang membagi data terurut menjadi dua bagian adalah...', 'Binary Search', 'Bubble Sort', 'left'),
('mahasiswa', 'Konsep OOP yang memungkinkan kelas mewarisi sifat kelas lain disebut...', 'Polimorfisme', 'Inheritance', 'right');
