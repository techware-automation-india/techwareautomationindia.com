-- ============================================================================
-- HOSTINGER MYSQL DATABASE SCHEMA UPDATE / PATCH SCRIPT
-- Techware Automation INDIA
-- Run this script in Hostinger phpMyAdmin (SQL Tab) to add all missing tables & columns
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD MISSING COLUMNS TO `users` TABLE
-- ----------------------------------------------------------------------------
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'roleId';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `roleId` VARCHAR(191) NULL;'
));
PREPARE addRoleId FROM @preparedStatement;
EXECUTE addRoleId;
DEALLOCATE PREPARE addRoleId;

-- ----------------------------------------------------------------------------
-- 2. CREATE `roles` TABLE IF NOT EXISTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. CREATE `role_modules` TABLE IF NOT EXISTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `role_modules` (
    `roleId` VARCHAR(191) NOT NULL,
    `moduleKey` VARCHAR(191) NOT NULL,

    INDEX `role_modules_roleId_idx`(`roleId`),
    PRIMARY KEY (`roleId`, `moduleKey`),
    CONSTRAINT `role_modules_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. ADD MISSING COLUMNS TO `leave_types` TABLE
-- ----------------------------------------------------------------------------
SET @tablename = 'leave_types';

-- maxConsecutiveDays
SET @columnname = 'maxConsecutiveDays';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `leave_types` ADD COLUMN `maxConsecutiveDays` INT NULL DEFAULT 0;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- minAdvanceNoticeDays
SET @columnname = 'minAdvanceNoticeDays';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `leave_types` ADD COLUMN `minAdvanceNoticeDays` INT NULL DEFAULT 0;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- isPaid
SET @columnname = 'isPaid';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `leave_types` ADD COLUMN `isPaid` BOOLEAN NOT NULL DEFAULT true;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- isActive
SET @columnname = 'isActive';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `leave_types` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- requiresApproval
SET @columnname = 'requiresApproval';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `leave_types` ADD COLUMN `requiresApproval` BOOLEAN NOT NULL DEFAULT true;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 5. ADD MISSING COLUMNS TO `holidays` TABLE
-- ----------------------------------------------------------------------------
SET @tablename = 'holidays';

-- holidayType
SET @columnname = 'holidayType';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `holidays` ADD COLUMN `holidayType` ENUM(\'NATIONAL\', \'FESTIVAL\', \'OPTIONAL\') NOT NULL DEFAULT \'FESTIVAL\';'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- isOptional
SET @columnname = 'isOptional';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `holidays` ADD COLUMN `isOptional` BOOLEAN NOT NULL DEFAULT false;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- isRecurring
SET @columnname = 'isRecurring';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `holidays` ADD COLUMN `isRecurring` BOOLEAN NOT NULL DEFAULT false;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 6. ADD REVIEW COLUMNS TO `leave_requests` TABLE
-- ----------------------------------------------------------------------------
SET @tablename = 'leave_requests';

-- reviewedById
SET @columnname = 'reviewedById';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `leave_requests` ADD COLUMN `reviewedById` VARCHAR(191) NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviewNote
SET @columnname = 'reviewNote';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `leave_requests` ADD COLUMN `reviewNote` VARCHAR(191) NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviewedAt
SET @columnname = 'reviewedAt';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `leave_requests` ADD COLUMN `reviewedAt` DATETIME(3) NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 7. ADD REVIEW COLUMNS TO `employee_requests` TABLE
-- ----------------------------------------------------------------------------
SET @tablename = 'employee_requests';

-- reviewedById
SET @columnname = 'reviewedById';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `employee_requests` ADD COLUMN `reviewedById` VARCHAR(191) NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviewNote
SET @columnname = 'reviewNote';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `employee_requests` ADD COLUMN `reviewNote` VARCHAR(191) NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviewedAt
SET @columnname = 'reviewedAt';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `employee_requests` ADD COLUMN `reviewedAt` DATETIME(3) NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 8. ADD MISSING COLUMNS TO `attendance` TABLE
-- ----------------------------------------------------------------------------
SET @tablename = 'attendance';

-- overtimeHours
SET @columnname = 'overtimeHours';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `attendance` ADD COLUMN `overtimeHours` DOUBLE NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- checkInLatitude
SET @columnname = 'checkInLatitude';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `attendance` ADD COLUMN `checkInLatitude` DOUBLE NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- checkInLongitude
SET @columnname = 'checkInLongitude';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `attendance` ADD COLUMN `checkInLongitude` DOUBLE NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- checkOutLatitude
SET @columnname = 'checkOutLatitude';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `attendance` ADD COLUMN `checkOutLatitude` DOUBLE NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- checkOutLongitude
SET @columnname = 'checkOutLongitude';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `attendance` ADD COLUMN `checkOutLongitude` DOUBLE NULL;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 9. CREATE DEFAULT ROLES (ADMIN, EMPLOYEE, CUSTOMER) IF NOT PRESENT
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `roles` (`id`, `name`, `isDefault`, `createdAt`, `updatedAt`)
VALUES 
  (UUID(), 'Admin', true, NOW(), NOW()),
  (UUID(), 'Employee', true, NOW(), NOW()),
  (UUID(), 'Customer', true, NOW(), NOW());

-- ----------------------------------------------------------------------------
-- 10. ADD `assignedTools` COLUMN TO `employee_profiles` TABLE
-- ----------------------------------------------------------------------------
SET @tablename = 'employee_profiles';
SET @columnname = 'assignedTools';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE `employee_profiles` ADD COLUMN `assignedTools` TEXT NULL AFTER `skills`;'
));
PREPARE stmt FROM @preparedStatement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '✅ Hostinger Schema Update / Patch Script Executed Successfully!' AS status;
