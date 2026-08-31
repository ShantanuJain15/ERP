-- Drop all inventory tables in `erp_db`.
-- DESTRUCTIVE: this deletes every inventory table and all of its data.
-- Run from the project root:
--   mysql -u root -p erp_db < backend/sql/drop_inventory_tables.sql
-- Then recreate with:
--   mysql -u root -p erp_db < backend/sql/inventory_schema.sql

SET NAMES utf8mb4;
USE `erp_db`;

-- Disabled so drop order cannot fail on foreign keys; tables are still
-- listed children-first below in case this script is run piecemeal.
SET FOREIGN_KEY_CHECKS = 0;

-- Line items / dependent tables first
DROP TABLE IF EXISTS `inventory_invoiceitem`;
DROP TABLE IF EXISTS `inventory_invoice`;
DROP TABLE IF EXISTS `inventory_solineitem`;
DROP TABLE IF EXISTS `inventory_salesorder`;
DROP TABLE IF EXISTS `inventory_polineitem`;
DROP TABLE IF EXISTS `inventory_purchaseorder`;
DROP TABLE IF EXISTS `inventory_stockmovement`;
DROP TABLE IF EXISTS `inventory_warehousestock`;
DROP TABLE IF EXISTS `inventory_acproduct`;

-- Core tables
DROP TABLE IF EXISTS `inventory_product`;
DROP TABLE IF EXISTS `inventory_customer`;
DROP TABLE IF EXISTS `inventory_warehouse`;
DROP TABLE IF EXISTS `inventory_supplier`;

-- Legacy tables removed by inventory migration 0006 (safe no-ops if absent)
DROP TABLE IF EXISTS `inventory_stocktransaction`;
DROP TABLE IF EXISTS `inventory_stocklocation`;

SET FOREIGN_KEY_CHECKS = 1;
