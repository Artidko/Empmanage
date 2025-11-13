-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: localhost    Database: ems_db
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `clock_in` datetime NOT NULL,
  `clock_out` datetime DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `clock_in_lat` decimal(10,7) DEFAULT NULL,
  `clock_in_lng` decimal(10,7) DEFAULT NULL,
  `clock_in_accuracy` float DEFAULT NULL,
  `clock_out_lat` decimal(10,7) DEFAULT NULL,
  `clock_out_lng` decimal(10,7) DEFAULT NULL,
  `clock_out_accuracy` float DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (6,8,'2025-10-31 16:50:23',NULL,NULL,14.0235495,99.9926605,212,NULL,NULL,NULL),(7,13,'2025-10-31 17:34:20','2025-10-31 17:34:24',NULL,14.0235495,99.9926605,212,14.0235495,99.9926605,212),(8,16,'2025-11-01 11:17:24',NULL,NULL,14.0235495,99.9926605,212,NULL,NULL,NULL);
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contracts`
--

DROP TABLE IF EXISTS `contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contracts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(160) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `contracts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contracts`
--

LOCK TABLES `contracts` WRITE;
/*!40000 ALTER TABLE `contracts` DISABLE KEYS */;
/*!40000 ALTER TABLE `contracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_documents`
--

DROP TABLE IF EXISTS `employee_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` enum('employment_contract','salary_certificate','other') DEFAULT 'other',
  `title` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `size` bigint DEFAULT NULL,
  `signed_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `status` varchar(30) DEFAULT 'ready',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `type` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_documents`
--

LOCK TABLES `employee_documents` WRITE;
/*!40000 ALTER TABLE `employee_documents` DISABLE KEYS */;
INSERT INTO `employee_documents` VALUES (1,16,'employment_contract','imagerice.png','uploads/docs/16/1761972902577.png','http://localhost:4000/uploads/docs/16/1761972902577.png','image/png',579005,NULL,NULL,'ready','2025-11-01 04:55:02','2025-11-01 04:55:02'),(2,16,'employment_contract','S__8732678_0.jpg','uploads/docs/16/1761973036340.jpg','http://localhost:4000/uploads/docs/16/1761973036340.jpg','image/jpeg',183907,NULL,NULL,'ready','2025-11-01 04:57:16','2025-11-01 04:57:16');
/*!40000 ALTER TABLE `employee_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_profiles`
--

DROP TABLE IF EXISTS `employee_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_profiles` (
  `user_id` int NOT NULL,
  `department` varchar(80) DEFAULT NULL,
  `position_title` varchar(80) DEFAULT NULL,
  `position` varchar(100) DEFAULT NULL,
  `salary_base` decimal(12,2) DEFAULT '0.00',
  `address` text,
  `emergency_contact` varchar(120) DEFAULT NULL,
  `employee_code` varchar(20) DEFAULT NULL,
  `work_hours_per_day` decimal(4,2) DEFAULT '8.00',
  `level` varchar(40) DEFAULT NULL,
  `emp_code` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `emp_code_uq` (`emp_code`),
  CONSTRAINT `employee_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_emp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_profiles`
--

LOCK TABLES `employee_profiles` WRITE;
/*!40000 ALTER TABLE `employee_profiles` DISABLE KEYS */;
INSERT INTO `employee_profiles` VALUES (8,'IT','นักพัฒนาซอฟต์แวร์',NULL,45000.00,NULL,NULL,NULL,8.00,NULL,'EMP002'),(11,'IT','นักพัฒนาซอฟต์แวร์',NULL,45000.00,NULL,NULL,NULL,8.00,NULL,'EMP005'),(13,'IT','นักพัฒนาซอฟต์แวร์',NULL,45000.00,NULL,NULL,NULL,8.00,NULL,'EMP003'),(14,'IT','นักพัฒนาซอฟต์แวร์',NULL,45000.00,NULL,NULL,NULL,8.00,NULL,'EMP004'),(16,'IT','คนเก่า',NULL,10000.00,NULL,NULL,NULL,8.00,NULL,'EMP010'),(17,'ปฏิบัติการ','ลูกจ้าง',NULL,10000.00,NULL,NULL,NULL,8.00,NULL,'EMP011');
/*!40000 ALTER TABLE `employee_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leave_requests`
--

DROP TABLE IF EXISTS `leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `leave_type` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` text,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `approved_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `leave_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_requests_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_requests`
--

LOCK TABLES `leave_requests` WRITE;
/*!40000 ALTER TABLE `leave_requests` DISABLE KEYS */;
INSERT INTO `leave_requests` VALUES (1,11,'ลาป่วย','2025-11-01','2025-11-02','ไม่สบาย','rejected',NULL,'2025-10-30 10:02:09'),(3,13,'ลากิจ','2025-10-31','2025-11-03','พาพ่อไปโรงพยาบาล','approved',NULL,'2025-10-30 10:50:53');
/*!40000 ALTER TABLE `leave_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payroll`
--

DROP TABLE IF EXISTS `payroll`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `month_year` char(7) NOT NULL,
  `gross` decimal(12,2) NOT NULL,
  `deductions` decimal(12,2) NOT NULL DEFAULT '0.00',
  `net` decimal(12,2) NOT NULL,
  `generated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_month` (`user_id`,`month_year`),
  CONSTRAINT `payroll_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payroll`
--

LOCK TABLES `payroll` WRITE;
/*!40000 ALTER TABLE `payroll` DISABLE KEYS */;
/*!40000 ALTER TABLE `payroll` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payrolls`
--

DROP TABLE IF EXISTS `payrolls`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payrolls` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `month_year` char(7) NOT NULL,
  `base` decimal(12,2) NOT NULL DEFAULT '0.00',
  `bonus` decimal(12,2) NOT NULL DEFAULT '0.00',
  `deduction` decimal(12,2) NOT NULL DEFAULT '0.00',
  `net` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending','paid') NOT NULL DEFAULT 'pending',
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_month` (`user_id`,`month_year`),
  KEY `idx_month` (`month_year`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payrolls`
--

LOCK TABLES `payrolls` WRITE;
/*!40000 ALTER TABLE `payrolls` DISABLE KEYS */;
INSERT INTO `payrolls` VALUES (1,3,'2025-10',0.00,0.00,0.00,0.00,'pending',NULL,'2025-10-31 21:31:27','2025-10-31 23:54:59'),(2,8,'2025-10',45000.00,0.00,0.00,45000.00,'pending',NULL,'2025-10-31 21:31:27','2025-10-31 23:55:00'),(3,11,'2025-10',45000.00,0.00,0.00,45000.00,'pending',NULL,'2025-10-31 21:31:27','2025-10-31 23:55:00'),(4,13,'2025-10',45000.00,0.00,0.00,45000.00,'pending',NULL,'2025-10-31 21:31:27','2025-10-31 23:55:00'),(5,14,'2025-10',45000.00,0.00,0.00,45000.00,'pending',NULL,'2025-10-31 21:31:27','2025-10-31 23:55:00'),(6,15,'2025-10',45000.00,0.00,0.00,45000.00,'pending',NULL,'2025-10-31 21:31:27','2025-10-31 23:55:00'),(7,3,'2025-09',0.00,0.00,0.00,0.00,'pending',NULL,'2025-10-31 21:31:45','2025-10-31 21:32:02'),(8,8,'2025-09',45000.00,0.00,0.00,45000.00,'paid','2025-10-31 23:25:31','2025-10-31 21:31:45','2025-10-31 23:25:31'),(9,11,'2025-09',45000.00,0.00,0.00,45000.00,'pending',NULL,'2025-10-31 21:31:45','2025-10-31 21:32:02'),(10,13,'2025-09',45000.00,0.00,0.00,45000.00,'pending',NULL,'2025-10-31 21:31:45','2025-10-31 21:32:02'),(11,14,'2025-09',45000.00,0.00,0.00,45000.00,'paid','2025-10-31 23:25:32','2025-10-31 21:31:45','2025-10-31 23:25:32'),(12,15,'2025-09',45000.00,0.00,0.00,45000.00,'pending',NULL,'2025-10-31 21:31:45','2025-10-31 21:32:02'),(43,16,'2025-10',10000.00,0.00,0.00,10000.00,'pending',NULL,'2025-10-31 23:25:19','2025-10-31 23:55:00');
/*!40000 ALTER TABLE `payrolls` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` tinyint NOT NULL,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin'),(2,'employee');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_salaries`
--

DROP TABLE IF EXISTS `user_salaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_salaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `month_year` char(7) NOT NULL,
  `payroll_id` int DEFAULT NULL,
  `emp_code` varchar(50) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `base_amount` decimal(12,2) DEFAULT '0.00',
  `bonus_amount` decimal(12,2) DEFAULT '0.00',
  `deduction_amount` decimal(12,2) DEFAULT '0.00',
  `net_amount` decimal(12,2) DEFAULT '0.00',
  `status` varchar(20) DEFAULT 'paid',
  `paid_at` datetime DEFAULT NULL,
  `meta_json` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_month` (`user_id`,`month_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_salaries`
--

LOCK TABLES `user_salaries` WRITE;
/*!40000 ALTER TABLE `user_salaries` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_salaries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` tinyint NOT NULL DEFAULT '2',
  `email` varchar(120) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,1,'admin@company.local','$2a$10$y0QnDTnhYo4KXhE4UCKvN.aBwEW7M3MHizf2a7SJ/7/RUJJBGaZVq','System Admin',NULL,NULL,'active','2025-10-10 06:56:08'),(3,2,'employee1@company.local','<EMP_HASH>','สมชาย ใจดี',NULL,'2023-01-01','active','2025-10-10 08:30:14'),(8,2,'emp002@company.local','$2a$10$vqBSoPl3PGVDl6F5pAAef..RWH1r2xBy6QvXiu3L.y.SwnBARF5s6','สมชาย ใจดี',NULL,NULL,'active','2025-10-10 14:02:28'),(11,2,'emp005@company.local','$2a$10$udsX6sfB9JCDwlxfrQK5kuY7NrpfAcMzoDDNOBYlkW55rWboIovlO','สมพงศ์ ใจดี',NULL,NULL,'active','2025-10-29 16:33:08'),(13,2,'emp003@company.local','$2a$10$QGU5g2eJWIl8ac3118g4AOWYMUaId05pSJ.vMNhp9msT5v..6nybu','สมจิต ใจดี',NULL,NULL,'active','2025-10-29 17:35:01'),(14,2,'emp004@company.local','$2a$10$RXCQ8yToxxh2z7JnhT3oD.Yu8fYxsKGJEMCozepkowDI7O/Pnrvou','สมใจ ใจดี',NULL,NULL,'active','2025-10-29 17:57:14'),(16,2,'emp010@company.local','$2a$10$taN3OEi7r1H2BO0IT6IGpuMGHxPA/eg5TyioEbnQbx0jphB.AbB2m','ดิว วี่',NULL,NULL,'active','2025-10-31 16:23:03'),(17,2,'emp011@company.local','$2a$10$uAfQzepkn5VyrM3KtOtMd.XvNJY2vayL5at905b9E81bYYFYPXyla','ศุภกานต์ ชาติฉุน',NULL,NULL,'active','2025-11-01 05:12:28');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'ems_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-01 13:03:49
