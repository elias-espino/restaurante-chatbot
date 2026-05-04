ALTER TABLE `restaurants`
  ADD COLUMN `aiEnabled`     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `aiPersonality` TEXT    NULL;
