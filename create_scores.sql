CREATE TABLE IF NOT EXISTS `scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_name` VARCHAR(100) NOT NULL,
  `class_name` VARCHAR(50) NOT NULL,
  `level` VARCHAR(20) NOT NULL,
  `score` INT NOT NULL,
  `accuracy` INT NOT NULL,
  `time_spent` VARCHAR(20) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `scores` (`student_name`, `class_name`, `level`, `score`, `accuracy`, `time_spent`) VALUES
('Budi Santoso', '8-A', 'smp', 40, 80, '0m 45s'),
('Siti Aminah', '5-B', 'sd', 50, 100, '0m 38s'),
('Ahmad Fauzi', 'Semester 4', 'mahasiswa', 30, 60, '1m 12s');
