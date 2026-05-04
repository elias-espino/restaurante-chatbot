-- Tabla de incidencias: escalación IA → humano
CREATE TABLE IF NOT EXISTS `incidencias` (
  `id`           VARCHAR(191) NOT NULL,
  `restaurantId` VARCHAR(191) NOT NULL,
  `phoneNumber`  VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(191) NULL,
  `status`       ENUM('OPEN', 'ANSWERED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `messages`     JSON NOT NULL DEFAULT ('[]'),
  `resolvedAt`   DATETIME(3) NULL,
  `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `incidencias_restaurantId_idx` (`restaurantId`),
  CONSTRAINT `incidencias_restaurantId_fkey`
    FOREIGN KEY (`restaurantId`) REFERENCES `restaurants` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
