-- Full inventory schema for MySQL-owned Django models.
-- MySQL uses "database" and "schema" almost interchangeably.
-- This script creates/uses the `erp_db` database/schema.
--
-- Run from the project root:
-- mysql -u root -p erp_db < backend/sql/inventory_schema.sql

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `erp_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `erp_db`;

CREATE TABLE IF NOT EXISTS `inventory_supplier` (
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

SET @product_quantity_check := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'inventory_product'
    AND CONSTRAINT_NAME = 'inventory_product_quantity_chk'
    AND CONSTRAINT_TYPE = 'CHECK'
  LIMIT 1
);
SET @drop_product_quantity_check := IF(
  @product_quantity_check IS NULL,
  'SELECT 1',
  'ALTER TABLE `inventory_product` DROP CHECK `inventory_product_quantity_chk`'
);
PREPARE drop_product_quantity_check_stmt FROM @drop_product_quantity_check;
EXECUTE drop_product_quantity_check_stmt;
DEALLOCATE PREPARE drop_product_quantity_check_stmt;

ALTER TABLE `inventory_product`
  MODIFY `quantity` int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS `inventory_warehouse` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `warehouse_type` varchar(20) NOT NULL DEFAULT 'MAIN',
  `address` longtext NOT NULL,
  `city` varchar(100) NOT NULL DEFAULT '',
  `state` varchar(100) NOT NULL DEFAULT '',
  `country` varchar(100) NOT NULL DEFAULT '',
  `phone` varchar(30) NOT NULL DEFAULT '',
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_warehouse_code_uniq` (`code`),
  CONSTRAINT `inventory_warehouse_type_chk`
    CHECK (`warehouse_type` IN ('MAIN', 'BRANCH', 'STORE', 'VIRTUAL'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_customer` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) NULL,
  `email` varchar(254) NULL,
  `address` longtext NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_modified_by_username` varchar(150) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_customer_phone_uniq` (`phone`),
  UNIQUE KEY `inventory_customer_email_uniq` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_product` (
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

CREATE TABLE IF NOT EXISTS `inventory_acproduct` (
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
  CONSTRAINT `inventory_acproduct_energy_label_chk`
    CHECK (`energy_label` IN ('', 'A+++', 'A++', 'A+', 'A', 'B', 'C')),
  CONSTRAINT `inventory_acproduct_refrigerant_type_chk`
    CHECK (`refrigerant_type` IN ('', 'R32', 'R410A', 'R22', 'R290'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_warehousestock` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `warehouse_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `quantity` int NOT NULL DEFAULT 0,
  `reserved_quantity` int unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_warehousestock_unique` (`warehouse_id`, `product_id`),
  KEY `inventory_warehousestock_product_id_idx` (`product_id`),
  CONSTRAINT `inventory_warehousestock_warehouse_id_fk`
    FOREIGN KEY (`warehouse_id`) REFERENCES `inventory_warehouse` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `inventory_warehousestock_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `inventory_product` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `inventory_warehousestock_quantity_chk`
    CHECK (`quantity` >= 0),
  CONSTRAINT `inventory_warehousestock_reserved_quantity_chk`
    CHECK (`reserved_quantity` >= 0 AND `reserved_quantity` <= `quantity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_stockmovement` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `movement_number` varchar(50) NOT NULL,
  `product_id` bigint NOT NULL,
  `warehouse_id` bigint NOT NULL,
  `movement_type` varchar(20) NOT NULL,
  `quantity` int unsigned NOT NULL,
  `quantity_change` int NOT NULL,
  `reference_type` varchar(20) NOT NULL DEFAULT 'MANUAL',
  `reference_number` varchar(100) NOT NULL DEFAULT '',
  `notes` longtext NOT NULL,
  `performed_by` varchar(150) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_stockmovement_number_uniq` (`movement_number`),
  KEY `inventory_stockmovement_product_id_idx` (`product_id`),
  KEY `inventory_stockmovement_warehouse_id_idx` (`warehouse_id`),
  KEY `inventory_stockmovement_created_at_idx` (`created_at`),
  CONSTRAINT `inventory_stockmovement_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `inventory_product` (`id`)
    ON DELETE RESTRICT,
  CONSTRAINT `inventory_stockmovement_warehouse_id_fk`
    FOREIGN KEY (`warehouse_id`) REFERENCES `inventory_warehouse` (`id`)
    ON DELETE RESTRICT,
  CONSTRAINT `inventory_stockmovement_type_chk`
    CHECK (`movement_type` IN ('IN', 'OUT', 'ADJ_UP', 'ADJ_DOWN', 'RETURN', 'DAMAGE')),
  CONSTRAINT `inventory_stockmovement_reference_type_chk`
    CHECK (`reference_type` IN ('PO', 'SO', 'INVOICE', 'MANUAL')),
  CONSTRAINT `inventory_stockmovement_quantity_chk`
    CHECK (`quantity` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_purchaseorder` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `po_number` varchar(50) NOT NULL,
  `supplier_id` bigint NOT NULL,
  `warehouse_id` bigint NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'DRAFT',
  `expected_date` date NULL,
  `received_date` date NULL,
  `notes` longtext NOT NULL,
  `created_by` varchar(150) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_purchaseorder_po_number_uniq` (`po_number`),
  KEY `inventory_purchaseorder_supplier_id_idx` (`supplier_id`),
  KEY `inventory_purchaseorder_warehouse_id_idx` (`warehouse_id`),
  CONSTRAINT `inventory_purchaseorder_supplier_id_fk`
    FOREIGN KEY (`supplier_id`) REFERENCES `inventory_supplier` (`id`)
    ON DELETE RESTRICT,
  CONSTRAINT `inventory_purchaseorder_warehouse_id_fk`
    FOREIGN KEY (`warehouse_id`) REFERENCES `inventory_warehouse` (`id`)
    ON DELETE RESTRICT,
  CONSTRAINT `inventory_purchaseorder_status_chk`
    CHECK (`status` IN ('DRAFT', 'CONFIRMED', 'RECEIVED', 'PARTIAL', 'CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_polineitem` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `quantity_ordered` int unsigned NOT NULL,
  `quantity_received` int unsigned NOT NULL DEFAULT 0,
  `unit_price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_polineitem_unique` (`purchase_order_id`, `product_id`),
  KEY `inventory_polineitem_product_id_idx` (`product_id`),
  CONSTRAINT `inventory_polineitem_purchase_order_id_fk`
    FOREIGN KEY (`purchase_order_id`) REFERENCES `inventory_purchaseorder` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `inventory_polineitem_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `inventory_product` (`id`)
    ON DELETE RESTRICT,
  CONSTRAINT `inventory_polineitem_quantity_ordered_chk`
    CHECK (`quantity_ordered` >= 0),
  CONSTRAINT `inventory_polineitem_quantity_received_chk`
    CHECK (`quantity_received` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_salesorder` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `so_number` varchar(50) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_phone` varchar(30) NOT NULL DEFAULT '',
  `warehouse_id` bigint NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `order_date` date NOT NULL,
  `notes` longtext NOT NULL,
  `created_by` varchar(150) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_salesorder_so_number_uniq` (`so_number`),
  KEY `inventory_salesorder_warehouse_id_idx` (`warehouse_id`),
  CONSTRAINT `inventory_salesorder_warehouse_id_fk`
    FOREIGN KEY (`warehouse_id`) REFERENCES `inventory_warehouse` (`id`)
    ON DELETE RESTRICT,
  CONSTRAINT `inventory_salesorder_status_chk`
    CHECK (`status` IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_solineitem` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `sales_order_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `quantity` int unsigned NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_solineitem_unique` (`sales_order_id`, `product_id`),
  KEY `inventory_solineitem_product_id_idx` (`product_id`),
  CONSTRAINT `inventory_solineitem_sales_order_id_fk`
    FOREIGN KEY (`sales_order_id`) REFERENCES `inventory_salesorder` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `inventory_solineitem_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `inventory_product` (`id`)
    ON DELETE RESTRICT,
  CONSTRAINT `inventory_solineitem_quantity_chk`
    CHECK (`quantity` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_invoice` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50) NOT NULL,
  `customer_id` bigint NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `total_amount` decimal(10,2) NOT NULL DEFAULT 0,
  `paid_amount` decimal(10,2) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'DRAFT',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_modified_by_username` varchar(150) NOT NULL DEFAULT '',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_invoice_invoice_number_uniq` (`invoice_number`),
  KEY `inventory_invoice_customer_id_idx` (`customer_id`),
  CONSTRAINT `inventory_invoice_customer_id_fk`
    FOREIGN KEY (`customer_id`) REFERENCES `inventory_customer` (`id`)
    ON DELETE RESTRICT,
  CONSTRAINT `inventory_invoice_status_chk`
    CHECK (`status` IN ('PENDING', 'PAID', 'PARTIAL', 'DRAFT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_invoiceitem` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `quantity` int unsigned NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `description` longtext NOT NULL,
  `total` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `inventory_invoiceitem_invoice_id_idx` (`invoice_id`),
  KEY `inventory_invoiceitem_product_id_idx` (`product_id`),
  CONSTRAINT `inventory_invoiceitem_invoice_id_fk`
    FOREIGN KEY (`invoice_id`) REFERENCES `inventory_invoice` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `inventory_invoiceitem_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `inventory_product` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `inventory_invoiceitem_quantity_chk`
    CHECK (`quantity` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
