-- Classifica as marcas existentes na tabela MAKE por tipo:
--   1: Veículos
--   2: Produtos
--   3: Ambos
--
-- Aplicado em 2026-09-22 via API (PUT /makes/:id), registrado aqui para
-- referência. Rode este arquivo assim, se precisar reaplicar:
--   mysql -u badencar -p badencar < classify_make_type.sql

-- 1. Marcas de veículos
UPDATE `badencar`.`make` SET `TYPE` = 1
WHERE `ID_MAKE` IN (
  1,  -- FORD
  2,  -- MITSUBISH
  3,  -- Toyota
  4,  -- Volkswagen
  5,  -- Ford
  6,  -- Chevrolet
  7,  -- Honda
  8,  -- Hyundai
  9,  -- Nissan
  10, -- Fiat
  11, -- Renault
  12, -- Peugeot
  13, -- BMW
  14, -- Mercedes-Benz
  15, -- Audi
  16, -- Jeep
  17, -- Mitsubishi
  18, -- Kia
  19, -- Citroën
  20, -- Land Rover
  21, -- Volvo
  22, -- Subaru
  26  -- GM
);

-- 2. Marcas de produtos/peças
UPDATE `badencar`.`make` SET `TYPE` = 2
WHERE `ID_MAKE` IN (
  23, -- PETRONAS
  24, -- FREMAX
  25, -- BOSCH
  28, -- MTE
  30, -- TRW
  31, -- SCHADEK
  32, -- Mobil
  33  -- Fran
);

-- 3. Registro de teste identificado como lixo (nome "Novo Fabricante - APAGAR"),
--    sem modelos vinculados — removido a pedido do usuário.
DELETE FROM `badencar`.`make` WHERE `ID_MAKE` = 27;

-- 4. Conferir resultado
SELECT ID_MAKE, NAME, TYPE FROM `badencar`.`make` ORDER BY ID_MAKE;
