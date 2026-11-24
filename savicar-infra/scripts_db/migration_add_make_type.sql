-- Migração: adiciona a coluna TYPE em MAKE, para distinguir marcas de
-- veículos, de produtos, ou ambos.
--
-- 1: Veículos
-- 2: Produtos
-- 3: Ambos
--
-- Este é o mesmo schema já aplicado no ambiente de desenvolvimento (ver
-- internal/domain/vehiclemake/entity.go) — aqui organizado para aplicar
-- no banco do cliente.
--
-- ANTES DE RODAR: faça backup da tabela.
--   mysqldump -u badencar -p badencar make > backup_make_YYYYMMDD.sql
--
-- Rode este arquivo assim:
--   mysql -u badencar -p badencar < migration_add_make_type.sql

-- 0. Conferir estrutura atual antes da migração
DESCRIBE `badencar`.`make`;

-- 1. Nova coluna
ALTER TABLE `badencar`.`make`
  ADD COLUMN `TYPE` INT NULL DEFAULT NULL
  COMMENT '1: Veiculos; 2: Produtos; 3: Ambos'
  AFTER `NAME`;

-- 2. Conferir resultado
DESCRIBE `badencar`.`make`;
SELECT ID_MAKE, NAME, TYPE FROM `badencar`.`make`;
