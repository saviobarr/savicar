-- Insere modelos de moto Honda em MODEL.
--
-- ID_MAKE = 7 é a Honda já cadastrada em MAKE neste banco (confirmado via
-- GET /makes). Se for rodar em outro ambiente, confira antes:
--   SELECT ID_MAKE FROM `badencar`.`make` WHERE NAME = 'Honda';
--
-- ID_FUEL = 2 (GASOLINA) foi aplicado a todos, já que a lista não traz
-- nenhum modelo elétrico/híbrido. Ajuste manualmente se algum destes
-- modelos tiver versão elétrica/híbrida específica.
--
-- Observação: "CRF 1100L Africa Twin Adventure Sports DCT" tem 42
-- caracteres — estoura o limite de NAME (char(30)). Foi dividido em
-- NAME = 'CRF 1100L Africa Twin' + VERSION = 'Adventure Sports DCT' para
-- caber na coluna (mesmo padrão usado nas variantes MT/DCT logo acima).
-- Todos os outros nomes couberam em 30 caracteres sem precisar dividir.
--
-- A Honda (ID_MAKE = 7) já tem 4 modelos de moto cadastrados hoje
-- (FAN 160, CB 300, CBR 1000 x2) — nenhum bate literalmente com os nomes
-- abaixo, então não há duplicidade exata, mas vale conferir manualmente
-- depois (ex.: "CB 300" existente vs "CB 300R"/"CB 300F Twister..." novos).
--
-- ANTES DE RODAR: faça backup da tabela.
--   mysqldump -u badencar -p badencar model > backup_model_YYYYMMDD.sql
--
-- Rode este arquivo assim:
--   mysql -u badencar -p badencar < insert_model_honda_motos.sql

INSERT INTO `badencar`.`model` (`ID_MAKE`, `NAME`, `VERSION`, `ID_FUEL`) VALUES
  (7, 'Pop 110i ES', '', 2),
  (7, 'Biz 125 ES', '', 2),
  (7, 'Biz 125 EX', '', 2),
  (7, 'CG 160 Start', '', 2),
  (7, 'CG 160 Fan', '', 2),
  (7, 'CG 160 Cargo', '', 2),
  (7, 'CG 160 Titan', '', 2),
  (7, 'Elite 125', '', 2),
  (7, 'PCX 160 CBS', '', 2),
  (7, 'PCX 160 ABS', '', 2),
  (7, 'PCX 160 DLX', '', 2),
  (7, 'ADV 160', '', 2),
  (7, 'Forza 350', '', 2),
  (7, 'X-ADV 750', '', 2),
  (7, 'CB 300F Twister CBS', '', 2),
  (7, 'CB 300F Twister ABS', '', 2),
  (7, 'CB 500 Hornet', '', 2),
  (7, 'CB 650R E-Clutch', '', 2),
  (7, 'CB 750 Hornet', '', 2),
  (7, 'CB 1000 Hornet', '', 2),
  (7, 'CB 1000R', '', 2),
  (7, 'NXR 160 Bros CBS', '', 2),
  (7, 'NXR 160 Bros ABS', '', 2),
  (7, 'XRE 190 ABS', '', 2),
  (7, 'XR 300L Tornado', '', 2),
  (7, 'Sahara 300 Standard', '', 2),
  (7, 'Sahara 300 Rally', '', 2),
  (7, 'Sahara 300 Adventure', '', 2),
  (7, 'NX 500', '', 2),
  (7, 'NC 750X MT', '', 2),
  (7, 'NC 750X DCT', '', 2),
  (7, 'XL 750 Transalp', '', 2),
  (7, 'CRF 1100L Africa Twin MT', '', 2),
  (7, 'CRF 1100L Africa Twin DCT', '', 2),
  (7, 'CRF 1100L Africa Twin', 'Adventure Sports DCT', 2),
  (7, 'CBR 650R E-Clutch', '', 2),
  (7, 'CBR 1000RR-R Fireblade SP', '', 2),
  (7, 'GL 1800 Gold Wing Tour DCT', '', 2),
  (7, 'CRF 300F', '', 2),
  (7, 'CRF 250R', '', 2),
  (7, 'CRF 250RX', '', 2),
  (7, 'CRF 450R', '', 2),
  (7, 'CRF 450RX', '', 2),
  (7, 'CG 125 Bolinha', '', 2),
  (7, 'CG 125 Today', '', 2),
  (7, 'CG 125 Titan', '', 2),
  (7, 'CG 125 Fan', '', 2),
  (7, 'CG 125 Cargo', '', 2),
  (7, 'CG 150 Titan', '', 2),
  (7, 'CG 150 Fan', '', 2),
  (7, 'CG 150 Sport', '', 2),
  (7, 'CG 150 Job', '', 2),
  (7, 'C100 Dream', '', 2),
  (7, 'Biz 100', '', 2),
  (7, 'Biz 110i', '', 2),
  (7, 'Lead 110', '', 2),
  (7, 'Spacy 125', '', 2),
  (7, 'SH 150i', '', 2),
  (7, 'SH 300i', '', 2),
  (7, 'CBX 150 Aero', '', 2),
  (7, 'CBX 200 Strada', '', 2),
  (7, 'CBX 250 Twister', '', 2),
  (7, 'CB 250F Twister', '', 2),
  (7, 'CB 300R', '', 2),
  (7, 'CB 400', '', 2),
  (7, 'CB 450 DX', '', 2),
  (7, 'CB 450 Custom', '', 2),
  (7, 'CB 500', '', 2),
  (7, 'CB 500F', '', 2),
  (7, 'CB 500X', '', 2),
  (7, 'CBR 500R', '', 2),
  (7, 'CB 600F Hornet', '', 2),
  (7, 'CB 650F', '', 2),
  (7, 'CBR 650F', '', 2),
  (7, 'CB 1300 Super Four', '', 2),
  (7, 'XL 125 S', '', 2),
  (7, 'XLR 125', '', 2),
  (7, 'XLX 250R', '', 2),
  (7, 'XLX 350R', '', 2),
  (7, 'NX 150', '', 2),
  (7, 'NX 200', '', 2),
  (7, 'XR 200R', '', 2),
  (7, 'XR 250 Tornado', '', 2),
  (7, 'NX 350 Sahara', '', 2),
  (7, 'NX 400 Falcon', '', 2),
  (7, 'NX 400i Falcon', '', 2),
  (7, 'XRE 300', '', 2),
  (7, 'XL 700V Transalp', '', 2),
  (7, 'XL 1000V Varadero', '', 2),
  (7, 'CRF 230F', '', 2),
  (7, 'CBR 450SR', '', 2),
  (7, 'CBX 750F', '', 2),
  (7, 'CBR 600F', '', 2),
  (7, 'CBR 600RR', '', 2),
  (7, 'CBR 900RR Fireblade', '', 2),
  (7, 'CBR 1000F', '', 2),
  (7, 'CBR 1000RR Fireblade', '', 2),
  (7, 'CBR 1100XX Super Blackbird', '', 2),
  (7, 'VT 600 Shadow', '', 2),
  (7, 'Shadow 750', '', 2),
  (7, 'Magna 750', '', 2),
  (7, 'VTX 1800', '', 2),
  (7, 'Valkyrie 1500', '', 2),
  (7, 'GL 1500 Gold Wing', '', 2);

-- Conferir resultado (deve retornar 104 linhas novas para a Honda)
SELECT ID_MODEL, NAME, VERSION, ID_FUEL
FROM `badencar`.`model`
WHERE ID_MAKE = 7
ORDER BY ID_MODEL DESC
LIMIT 104;
