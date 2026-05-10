-- Habilitar solicitud de ubicación WhatsApp por restaurante
ALTER TABLE `restaurants`
  ADD COLUMN `deliveryLocationEnabled` BOOLEAN NOT NULL DEFAULT FALSE;

-- Guardar coordenadas GPS del cliente en la orden (opcional)
ALTER TABLE `orders`
  ADD COLUMN `deliveryLatitude`  DOUBLE NULL,
  ADD COLUMN `deliveryLongitude` DOUBLE NULL;
