-- ==============================================================================
-- TECHWARE AUTOCARD - HOSTINGER DATABASE MIGRATION PATCH
-- Database: u553274077_techware_db
-- Run this script in Hostinger phpMyAdmin > SQL tab
-- ==============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. CREATE MISSING INVENTORY TABLES (Not present on Hostinger)
-- ------------------------------------------------------------------------------

-- Table 1: inventory_categories (Supports up to 4 hierarchy levels)
CREATE TABLE IF NOT EXISTS `inventory_categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inventory_categories_code_key`(`code`),
    INDEX `inventory_categories_parentId_idx`(`parentId`),
    INDEX `inventory_categories_level_idx`(`level`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Table 2: inventory_units (Dynamic custom units like Nos, Pcs, Kg, Meter, etc.)
CREATE TABLE IF NOT EXISTS `inventory_units` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inventory_units_name_key`(`name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Table 3: inventory_items (Inventory item catalog, specifications, stock quantities)
CREATE TABLE IF NOT EXISTS `inventory_items` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `photoUrl` TEXT NULL,
    `specifications` JSON NULL,
    `quantity` DOUBLE NOT NULL DEFAULT 0,
    `minStock` INTEGER NOT NULL DEFAULT 5,
    `maxStock` INTEGER NULL DEFAULT 100,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'Nos',
    `location` VARCHAR(191) NULL,
    `warehouse` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `costPrice` DOUBLE NULL,
    `purchaseDate` DATETIME(3) NULL,
    `date` DATETIME(3) NULL,
    `companyName` VARCHAR(191) NULL,
    `vendorName` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inventory_items_code_key`(`code`),
    UNIQUE INDEX `inventory_items_sku_key`(`sku`),
    INDEX `inventory_items_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Table 4: inventory_issues (Material outward & return tracking)
CREATE TABLE IF NOT EXISTS `inventory_issues` (
    `id` VARCHAR(191) NOT NULL,
    `inventoryItemId` VARCHAR(191) NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `assignedToPerson` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `projectName` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `returnDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ISSUED',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. ADD FOREIGN KEYS FOR NEW INVENTORY TABLES
-- ------------------------------------------------------------------------------

-- Self-relation for Category hierarchy (Level 1 -> 2 -> 3 -> 4)
ALTER TABLE `inventory_categories` 
    DROP FOREIGN KEY IF EXISTS `inventory_categories_parentId_fkey`;
ALTER TABLE `inventory_categories` 
    ADD CONSTRAINT `inventory_categories_parentId_fkey` 
    FOREIGN KEY (`parentId`) REFERENCES `inventory_categories`(`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Inventory Item -> Category relation
ALTER TABLE `inventory_items` 
    DROP FOREIGN KEY IF EXISTS `inventory_items_categoryId_fkey`;
ALTER TABLE `inventory_items` 
    ADD CONSTRAINT `inventory_items_categoryId_fkey` 
    FOREIGN KEY (`categoryId`) REFERENCES `inventory_categories`(`id`) 
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Inventory Issue -> Inventory Item relation
ALTER TABLE `inventory_issues` 
    DROP FOREIGN KEY IF EXISTS `inventory_issues_inventoryItemId_fkey`;
ALTER TABLE `inventory_issues` 
    ADD CONSTRAINT `inventory_issues_inventoryItemId_fkey` 
    FOREIGN KEY (`inventoryItemId`) REFERENCES `inventory_items`(`id`) 
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------
-- 3. ENSURE ALL RECENT COLUMNS EXIST ON EXISTING HOSTINGER TABLES
-- ------------------------------------------------------------------------------

-- employee_profiles: assignedTools (for tool tracking & returns)
ALTER TABLE `employee_profiles` 
    ADD COLUMN IF NOT EXISTS `assignedTools` TEXT NULL;

-- attendance: overtimeHours & GPS coordinates
ALTER TABLE `attendance` 
    ADD COLUMN IF NOT EXISTS `overtimeHours` DOUBLE NULL,
    ADD COLUMN IF NOT EXISTS `checkInLatitude` DOUBLE NULL,
    ADD COLUMN IF NOT EXISTS `checkInLongitude` DOUBLE NULL,
    ADD COLUMN IF NOT EXISTS `checkOutLatitude` DOUBLE NULL,
    ADD COLUMN IF NOT EXISTS `checkOutLongitude` DOUBLE NULL;

-- leave_types: maxConsecutiveDays & minAdvanceNoticeDays
ALTER TABLE `leave_types` 
    ADD COLUMN IF NOT EXISTS `maxConsecutiveDays` INTEGER NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `minAdvanceNoticeDays` INTEGER NULL DEFAULT 0;

-- projects: progress & isArchived
ALTER TABLE `projects` 
    ADD COLUMN IF NOT EXISTS `progress` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `isArchived` BOOLEAN NOT NULL DEFAULT false;

-- inventory_items: companyName & vendorName (for vendor and manufacturer tracking)
ALTER TABLE `inventory_items`
    ADD COLUMN IF NOT EXISTS `companyName` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `vendorName` VARCHAR(191) NULL;

-- ------------------------------------------------------------------------------
-- 4. INSERT DEFAULT INVENTORY UNITS (Skip if already present)
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO `inventory_units` (`id`, `name`, `createdAt`) VALUES
    (UUID(), 'Nos', NOW(3)),
    (UUID(), 'Pcs', NOW(3)),
    (UUID(), 'Kg', NOW(3)),
    (UUID(), 'Meter', NOW(3)),
    (UUID(), 'Liter', NOW(3)),
    (UUID(), 'Box', NOW(3)),
    (UUID(), 'Set', NOW(3)),
    (UUID(), 'Roll', NOW(3)),
    (UUID(), 'Packet', NOW(3));

-- ------------------------------------------------------------------------------
-- 5. INSERT DEFAULT ROOT INVENTORY CATEGORIES (Skip if already present)
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO `inventory_categories` (`id`, `name`, `code`, `description`, `level`, `parentId`, `createdAt`, `updatedAt`) VALUES
    ('6b2a6c73-4969-4d8c-ae63-a64e80afde3f', 'Tools', 'TOOLS', 'Tools and Workshop Equipment', 1, NULL, NOW(3), NOW(3)),
    ('599bc987-2a7b-425f-a476-209e43c4e787', 'CONSUAMBLE', 'CONSUMABLE', 'Consumable Items and Materials', 1, NULL, NOW(3), NOW(3)),
    ('cefc82b4-ffab-48f3-aa63-d51531a2efb2', 'Mechanical', 'MECH', 'Mechanical Components and Hardware', 1, NULL, NOW(3), NOW(3)),
    ('768a6faf-286c-48b8-94bd-9a827fae0c72', 'Electrical', 'ELEC', 'Electrical and Electronic Components', 1, NULL, NOW(3), NOW(3)),
    ('3261dd2f-4a68-4f57-a9dc-2d13240d8e78', 'Pneumatic', 'PNEUM', 'Pneumatic Components and Cylinders', 1, NULL, NOW(3), NOW(3));

-- Subcategories under Tools & Mechanical & Electrical
INSERT IGNORE INTO `inventory_categories` (`id`, `name`, `code`, `description`, `level`, `parentId`, `createdAt`, `updatedAt`) VALUES
    ('777010a5-acd1-4a9a-9b4c-5191b938f030', 'Hand Tools', 'HAND-TOOLS', 'Hand Tools', 2, '6b2a6c73-4969-4d8c-ae63-a64e80afde3f', NOW(3), NOW(3)),
    ('23650ca7-0f91-4eaa-87b4-2cbf2248296a', 'Fasteners & Hardware', 'FASTENERS', 'Nuts, bolts, screws', 2, 'cefc82b4-ffab-48f3-aa63-d51531a2efb2', NOW(3), NOW(3)),
    ('b42d57cf-e740-4437-8017-407aa1424aaf', 'Cables & Wires', 'WIRES', 'Wiring and cabling', 2, '768a6faf-286c-48b8-94bd-9a827fae0c72', NOW(3), NOW(3)),
    ('726eb733-36a4-40b9-9386-9db6504b8f81', 'Cylinder', 'CYL', 'Pneumatic cylinders', 2, '3261dd2f-4a68-4f57-a9dc-2d13240d8e78', NOW(3), NOW(3));

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- DONE! All missing tables, columns, foreign keys, and seed categories are ready.
-- ==============================================================================
