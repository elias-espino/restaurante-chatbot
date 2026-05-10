-- AlterTable: agregar printerId a menu_items
ALTER TABLE `menu_items` ADD COLUMN `printerId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_printerId_fkey`
  FOREIGN KEY (`printerId`) REFERENCES `printers`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
