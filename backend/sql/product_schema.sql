-- Inventory product schema for MySQL.
-- MySQL uses "database" and "schema" almost interchangeably.
-- This script creates/uses the `erp_db` database/schema.
-- Run from the project root:
-- mysql -u root -p erp_db < backend/sql/product_schema.sql

SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `erp_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `erp_db`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `inventory_acproduct`;
DROP TABLE IF EXISTS `inventory_product`;
DROP TABLE IF EXISTS `inventory_supplier`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `inventory_supplier` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `contact_person` varchar(150) NOT NULL DEFAULT '',
  `email` varchar(254) NOT NULL DEFAULT '',
  `phone` varchar(30) NOT NULL DEFAULT '',
  `address` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `inventory_product` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `type` varchar(20) NULL,
  `sku` varchar(64) NOT NULL DEFAULT '',
  `brand` varchar(100) NULL,
  `description` longtext NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT 0,
  `reorder_level` int unsigned NOT NULL DEFAULT 0,
  `supplier_id` bigint NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_modified_by_username` varchar(150) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_product_sku_uniq` (`sku`),
  KEY `inventory_product_supplier_id_idx` (`supplier_id`),
  KEY `inventory_product_name_idx` (`name`),
  CONSTRAINT `inventory_product_supplier_id_fk`
    FOREIGN KEY (`supplier_id`) REFERENCES `inventory_supplier` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `inventory_product_type_chk`
    CHECK (`type` IN ('AC', 'GENERIC') OR `type` IS NULL),
  CONSTRAINT `inventory_product_reorder_level_chk`
    CHECK (`reorder_level` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `inventory_acproduct` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL,
  `tonnage` decimal(4,1) NOT NULL,
  `star_rating` smallint unsigned NOT NULL DEFAULT 3,
  `energy_label` varchar(10) NOT NULL DEFAULT '',
  `refrigerant_type` varchar(20) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_acproduct_product_id_uniq` (`product_id`),
  CONSTRAINT `inventory_acproduct_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `inventory_product` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `inventory_acproduct_star_rating_chk`
    CHECK (`star_rating` >= 0),
  CONSTRAINT `inventory_acproduct_energy_label_chk`
    CHECK (`energy_label` IN ('', 'A+++', 'A++', 'A+', 'A', 'B', 'C')),
  CONSTRAINT `inventory_acproduct_refrigerant_type_chk`
    CHECK (`refrigerant_type` IN ('', 'R32', 'R410A', 'R22', 'R290'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
