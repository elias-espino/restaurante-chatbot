-- ============================================================
-- Migración: Módulo de Delivery
-- Agrega: tabla riders, campos delivery en orders,
--         nuevo estado OUT_FOR_DELIVERY en enum OrderStatus
-- ============================================================

-- 1. Modificar el enum OrderStatus para agregar OUT_FOR_DELIVERY
ALTER TABLE `orders` MODIFY COLUMN `status` ENUM(
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED'
) NOT NULL DEFAULT 'PENDING';

-- 2. Crear tabla riders
CREATE TABLE `riders` (
  `id`           VARCHAR(191) NOT NULL,
  `restaurantId` VARCHAR(191) NOT NULL,
  `name`         VARCHAR(191) NOT NULL,
  `phone`        VARCHAR(191) NULL,
  `riderCode`    VARCHAR(4)   NOT NULL,
  `isActive`     BOOLEAN      NOT NULL DEFAULT true,
  `isAvailable`  BOOLEAN      NOT NULL DEFAULT true,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL,

  UNIQUE INDEX `riders_restaurantId_riderCode_key`(`restaurantId`, `riderCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. FK de riders → restaurants
ALTER TABLE `riders`
  ADD CONSTRAINT `riders_restaurantId_fkey`
  FOREIGN KEY (`restaurantId`) REFERENCES `restaurants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Agregar campos de delivery a la tabla orders
ALTER TABLE `orders`
  ADD COLUMN `riderId`             VARCHAR(191) NULL,
  ADD COLUMN `deliveryCode`        VARCHAR(4)   NULL,
  ADD COLUMN `deliveryAssignedAt`  DATETIME(3)  NULL,
  ADD COLUMN `deliveryStartedAt`   DATETIME(3)  NULL,
  ADD COLUMN `deliveryConfirmedAt` DATETIME(3)  NULL;

-- 5. FK de orders → riders
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_riderId_fkey`
  FOREIGN KEY (`riderId`) REFERENCES `riders`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
