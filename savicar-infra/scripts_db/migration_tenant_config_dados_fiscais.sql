-- Migração: adiciona os campos fiscais de NFS-e em TENANT_CONFIG (Série,
-- Inscrição Municipal, Simples Nacional, ISS, tributos) e a coluna
-- REFERENCIA em NF, e popula os valores da mastercar (id_tenant = 1).
--
-- Este é o mesmo schema já aplicado no ambiente de desenvolvimento (ver
-- internal/domain/tenantconfig/entity.go) — aqui organizado para aplicar
-- no banco do cliente.
--
-- ANTES DE RODAR: faça backup da tabela.
--   mysqldump -u badencar -p badencar tenant_config nf > backup_tenant_config_nf_YYYYMMDD.sql
--
-- ATENÇÃO — passo 3 (rename): pressupõe que já existe em TENANT_CONFIG uma
-- coluna chamada `tenant_configcol` (resquício de uma criação anterior) que
-- será renomeada para REGIME_TRIB_SIMPLES_NAC. Confira antes de rodar:
--   DESCRIBE tenant_config;
-- Se essa coluna NÃO existir no banco do cliente, pule o passo 3 e troque-o
-- por (ajustando o AFTER para a última coluna que existir):
--   ALTER TABLE `badencar`.`tenant_config`
--   ADD COLUMN `REGIME_TRIB_SIMPLES_NAC` INT NULL DEFAULT NULL
--   COMMENT 'regime_tributario_simples_nacional\n1: Regime de apuração dos tributos federais e municipal pelo SN;\n2: Regime de apuração dos tributos federais pelo SN e ISSQN por fora do SN conforme respectiva legislação municipal do tributo;\n3: Regime de apuração dos tributos federais e municipal por fora do SN conforme respectivas legislações federal e municipal de cada tributo.'
--   AFTER `OPT_CODE_SIMPLES`;
--
-- Rode este arquivo assim:
--   mysql -u badencar -p badencar < migration_tenant_config_dados_fiscais.sql

-- 0. Conferir estrutura atual antes da migração
DESCRIBE `badencar`.`tenant_config`;

-- 1. Campos de identificação da nota / série / códigos de serviço
ALTER TABLE `badencar`.`tenant_config`
  ADD COLUMN `ISS_PERCENT`           DECIMAL(3,2) NULL AFTER `API_KEY_NF`,
  ADD COLUMN `SERVICE_CODE`          VARCHAR(100) NULL AFTER `ISS_PERCENT`,
  ADD COLUMN `SERIE_INVOICE`         VARCHAR(2)   NULL AFTER `SERVICE_CODE`,
  ADD COLUMN `FEDERAL_SERVICE_CODE`  VARCHAR(10)  NULL AFTER `SERIE_INVOICE`,
  ADD COLUMN `CITY_SERVICE_CODE`     VARCHAR(45)  NULL AFTER `FEDERAL_SERVICE_CODE`,
  ADD COLUMN `PERCENT_FEDERAL_TAX`   DECIMAL(4,2) NULL AFTER `CITY_SERVICE_CODE`,
  ADD COLUMN `PERCENT_STATE_TAX`     DECIMAL(4,2) NULL AFTER `PERCENT_FEDERAL_TAX`,
  ADD COLUMN `PERCENT_MUNICIPAL_TAX` DECIMAL(4,2) NULL AFTER `PERCENT_STATE_TAX`;

-- 2. Inscrição municipal e retenção de ISSQN
ALTER TABLE `badencar`.`tenant_config`
  ADD COLUMN `MUNICIPAL_ID` VARCHAR(45) NULL AFTER `TAX_ID`,
  ADD COLUMN `TP_ISS_RETENTION` INT NULL
    COMMENT 'Tipo de retencao do ISSQN:\n\n1: Não Retido;\n2: Retido pelo Tomador;\n3: Retido pelo Intermediario.'
    AFTER `PERCENT_MUNICIPAL_TAX`,
  ADD COLUMN `OPT_CODE_SIMPLES` INT NULL
    COMMENT '1: Não Optante;\n2: Optante - Microempreendedor Individual (MEI);\n3: Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP).'
    AFTER `TP_ISS_RETENTION`;

-- 3. Renomeia a coluna placeholder para REGIME_TRIB_SIMPLES_NAC — ver aviso no topo
ALTER TABLE `badencar`.`tenant_config`
  CHANGE COLUMN `tenant_configcol` `REGIME_TRIB_SIMPLES_NAC` INT NULL DEFAULT NULL
  COMMENT 'regime_tributario_simples_nacional\n1: Regime de apuração dos tributos federais e municipal pelo SN;\n2: Regime de apuração dos tributos federais pelo SN e ISSQN por fora do SN conforme respectiva legislação municipal do tributo;\n3: Regime de apuração dos tributos federais e municipal por fora do SN conforme respectivas legislações federal e municipal de cada tributo.';

-- 4. Regime especial, código e tributação do ISS
ALTER TABLE `badencar`.`tenant_config`
  ADD COLUMN `REGIME_ESP_TRIBUTACAO` INT NULL
    COMMENT 'regime_especial_tributacao\n0: Nenhum;\n1: Ato Cooperado (Cooperativa);\n2: Estimativa;\n3: Microempresa Municipal;\n4: Notário ou Registrador;\n5: Profissional Autônomo;\n6: Sociedade de Profissionais;\n9: Outros;'
    AFTER `REGIME_TRIB_SIMPLES_NAC`,
  ADD COLUMN `CODIGO_TRIB_NAC_ISS` VARCHAR(20) NULL
    COMMENT 'codigo_tributacao_nacional_iss'
    AFTER `REGIME_ESP_TRIBUTACAO`,
  ADD COLUMN `TRIBUTACAO_ISS` INT NULL
    COMMENT 'tributacao_iss\n1: Operação tributável;\n2: Imunidade;\n3: Exportação de serviço;\n4: Não Incidência.'
    AFTER `CODIGO_TRIB_NAC_ISS`;

-- 5. Nova coluna em NF
ALTER TABLE `badencar`.`nf`
  ADD COLUMN `referencia` VARCHAR(45) NULL AFTER `numero`;

-- 6. Popula os valores fiscais da mastercar (id_tenant = 1)
UPDATE `badencar`.`tenant_config`
SET
  `ISS_PERCENT`             = 2.47,
  `SERIE_INVOICE`           = 'E',
  `FEDERAL_SERVICE_CODE`    = '14.01',
  `CITY_SERVICE_CODE`       = '14.01',
  `PERCENT_FEDERAL_TAX`     = 15.45,
  `PERCENT_STATE_TAX`       = 0.00,
  `PERCENT_MUNICIPAL_TAX`   = 4.69,
  `MUNICIPAL_ID`            = '33155',
  `TP_ISS_RETENTION`        = 1,
  `OPT_CODE_SIMPLES`        = 3,
  `REGIME_TRIB_SIMPLES_NAC` = 1,
  `REGIME_ESP_TRIBUTACAO`   = 0,
  `CODIGO_TRIB_NAC_ISS`     = '140101',
  `TRIBUTACAO_ISS`          = 1
WHERE `ID_TENANT` = 1;

-- 7. Conferir resultado
SELECT ID_TENANT, ISS_PERCENT, SERVICE_CODE, SERIE_INVOICE, FEDERAL_SERVICE_CODE,
       CITY_SERVICE_CODE, PERCENT_FEDERAL_TAX, PERCENT_STATE_TAX, PERCENT_MUNICIPAL_TAX,
       MUNICIPAL_ID, TP_ISS_RETENTION, OPT_CODE_SIMPLES, REGIME_TRIB_SIMPLES_NAC,
       REGIME_ESP_TRIBUTACAO, CODIGO_TRIB_NAC_ISS, TRIBUTACAO_ISS
FROM `badencar`.`tenant_config`
WHERE ID_TENANT = 1;

DESCRIBE `badencar`.`nf`;
