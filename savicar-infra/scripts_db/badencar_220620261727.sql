-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: badencar
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `city`
--

DROP TABLE IF EXISTS `city`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `city` (
  `ID_CITY` int NOT NULL AUTO_INCREMENT,
  `NAME` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ABBREVIATION` char(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ID_STATE` int DEFAULT NULL,
  PRIMARY KEY (`ID_CITY`),
  KEY `FK_CITY_STATE` (`ID_STATE`),
  CONSTRAINT `FK_CITY_STATE` FOREIGN KEY (`ID_STATE`) REFERENCES `state` (`ID_STATE`)
) ENGINE=InnoDB AUTO_INCREMENT=2897 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contact`
--

DROP TABLE IF EXISTS `contact`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact` (
  `ID_CONTACT` int NOT NULL AUTO_INCREMENT,
  `ID_CUSTOMER` int DEFAULT NULL,
  `MOBILE_PHONE` char(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IS_MOBILE_PHONE_WHATSAPP` tinyint(1) DEFAULT '1',
  `EMAIL` char(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ADDRESS` char(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ID_CITY` int DEFAULT NULL,
  `NEIGHBORHOOD` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ADDRESS_NUMBER` int DEFAULT NULL,
  PRIMARY KEY (`ID_CONTACT`),
  KEY `FK_CONTACT_CUSTOMER` (`ID_CUSTOMER`),
  KEY `FK_CONTACT_CITY1` (`ID_CITY`),
  CONSTRAINT `FK_CONTACT_CITY1` FOREIGN KEY (`ID_CITY`) REFERENCES `city` (`ID_CITY`),
  CONSTRAINT `FK_CONTACT_CUSTOMER` FOREIGN KEY (`ID_CUSTOMER`) REFERENCES `customer` (`ID_CUSTOMER`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cost_category`
--

DROP TABLE IF EXISTS `cost_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cost_category` (
  `ID_COST_CATEGORY` int NOT NULL AUTO_INCREMENT,
  `NAME` varchar(250) DEFAULT NULL,
  `TYPE` int DEFAULT NULL,
  `DESCRIPTION` text,
  PRIMARY KEY (`ID_COST_CATEGORY`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `country`
--

DROP TABLE IF EXISTS `country`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `country` (
  `ID_COUNTRY` int NOT NULL AUTO_INCREMENT,
  `NAME` char(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ABBREVIATION` char(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`ID_COUNTRY`)
) ENGINE=InnoDB AUTO_INCREMENT=197 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer`
--

DROP TABLE IF EXISTS `customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer` (
  `ID_CUSTOMER` int NOT NULL AUTO_INCREMENT,
  `IS_LEGAL_PERSON` tinyint(1) DEFAULT '0',
  `IS_ACTIVE` tinyint(1) DEFAULT '1',
  `LEGAL_NAME` char(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `TRADE_NAME` char(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `INDIVIDUAL_NAME` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DOB` date DEFAULT NULL,
  `GENDER` int DEFAULT NULL,
  `TAX_ID` char(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `WEB_SITE` char(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `STATE_REGISTRATION` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `MUNICIPAL_REGISTRATION` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IMAGE_PATH` char(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`ID_CUSTOMER`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_model`
--

DROP TABLE IF EXISTS `customer_model`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_model` (
  `ID_CUSTOMER_MODEL` int NOT NULL AUTO_INCREMENT,
  `ID_CUSTOMER` int NOT NULL,
  `ID_MODEL` int NOT NULL,
  `PLATE` char(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `YEAR_MAKE` int DEFAULT NULL,
  `YEAR_MODEL` int DEFAULT NULL,
  `COLOR` char(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `VIN` varchar(17) DEFAULT NULL,
  PRIMARY KEY (`ID_CUSTOMER_MODEL`),
  KEY `IX_CUSTOMER_MODEL` (`ID_CUSTOMER`),
  KEY `FK_CUSTOMER_MODEL_MODEL` (`ID_MODEL`),
  CONSTRAINT `FK_CUSTOMER_MODEL_CUSTOMER` FOREIGN KEY (`ID_CUSTOMER`) REFERENCES `customer` (`ID_CUSTOMER`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_CUSTOMER_MODEL_MODEL` FOREIGN KEY (`ID_MODEL`) REFERENCES `model` (`ID_MODEL`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fuel`
--

DROP TABLE IF EXISTS `fuel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fuel` (
  `ID_FUEL` int NOT NULL AUTO_INCREMENT,
  `NAME` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`ID_FUEL`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory`
--

DROP TABLE IF EXISTS `inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory` (
  `ID_PRODUCT` int NOT NULL AUTO_INCREMENT,
  `NAME` char(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CODE` char(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `PROVIDER` char(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ID_MAKE` int DEFAULT NULL,
  `MAKER_CODE` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `PROVIDER_CODE` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `INTERNAL_CODE` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `UNITY` char(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `GROSS_WEIGHT` int DEFAULT NULL,
  `NET_WEIGHT` int DEFAULT NULL,
  `STORAGE_LOCATION` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `MIN` int DEFAULT NULL,
  `MAX` int DEFAULT NULL,
  `GTIN_EAN_CODE` char(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SALES_PRICE` decimal(19,4) DEFAULT NULL,
  `COST_PRICE` decimal(19,4) DEFAULT NULL,
  `PRODUCT_SIZE` char(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `PRODUCT_ORIGIN` int DEFAULT NULL,
  `CLASSIFICATION_TYPE` int DEFAULT NULL,
  `INITIAL_INVENTORY_QUANTITY` int DEFAULT NULL,
  `CURRENT_QUANTITY` int DEFAULT NULL,
  `IMAGE_PATH` char(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ID_UNIT` int DEFAULT NULL,
  `ORIGINAL_NUMBER` varchar(255) DEFAULT NULL,
  `PRODUTC_DETAILS` varchar(255) DEFAULT NULL,
  `PRODUCT_DETAILS` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID_PRODUCT`),
  KEY `FK_INVENTORY_MAKE` (`ID_MAKE`),
  CONSTRAINT `FK_INVENTORY_MAKE` FOREIGN KEY (`ID_MAKE`) REFERENCES `make` (`ID_MAKE`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `make`
--

DROP TABLE IF EXISTS `make`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `make` (
  `ID_MAKE` int NOT NULL AUTO_INCREMENT,
  `NAME` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`ID_MAKE`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `model`
--

DROP TABLE IF EXISTS `model`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model` (
  `ID_MODEL` int NOT NULL AUTO_INCREMENT,
  `ID_MAKE` int DEFAULT NULL,
  `NAME` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `VERSION` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ID_FUEL` int DEFAULT NULL,
  PRIMARY KEY (`ID_MODEL`),
  KEY `FK_MODEL_FUEL` (`ID_FUEL`),
  KEY `FK_MODEL_MAKE` (`ID_MAKE`),
  CONSTRAINT `FK_MODEL_FUEL` FOREIGN KEY (`ID_FUEL`) REFERENCES `fuel` (`ID_FUEL`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_MODEL_MAKE` FOREIGN KEY (`ID_MAKE`) REFERENCES `make` (`ID_MAKE`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1246 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `operational_costs`
--

DROP TABLE IF EXISTS `operational_costs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operational_costs` (
  `ID_COST` int NOT NULL AUTO_INCREMENT,
  `ID_COST_CATEGORY` int DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `AMOUNT` decimal(10,2) DEFAULT NULL,
  `RECURRENCE` int DEFAULT NULL,
  `REFERENCE_DATE` date DEFAULT NULL,
  `ID_ORDER` int DEFAULT NULL,
  `CREATED_AT` timestamp NULL DEFAULT NULL,
  `DUE_DAY` int DEFAULT NULL,
  PRIMARY KEY (`ID_COST`),
  KEY `FK_COST_CATEGORY_idx` (`ID_COST_CATEGORY`),
  KEY `FK_SERVICE_ORDER_idx` (`ID_ORDER`),
  CONSTRAINT `FK_COST_CATEGORY` FOREIGN KEY (`ID_COST_CATEGORY`) REFERENCES `cost_category` (`ID_COST_CATEGORY`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_SERVICE_ORDER` FOREIGN KEY (`ID_ORDER`) REFERENCES `service_order` (`ID_ORDER`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment`
--

DROP TABLE IF EXISTS `payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment` (
  `ID_PAYMENT` int NOT NULL AUTO_INCREMENT,
  `ID_ORDER` int DEFAULT NULL,
  `ID_PAYMENT_METHOD` int DEFAULT NULL,
  `INSTALLMENTS_QUANTITY` char(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DUE_DATE` date DEFAULT NULL,
  `PAYMENT_DATE` date DEFAULT NULL,
  `VALUE` decimal(19,4) DEFAULT NULL,
  PRIMARY KEY (`ID_PAYMENT`),
  KEY `FK_PAYMENT_SERVICE_ORDER` (`ID_ORDER`),
  KEY `FK_PAYMENT_PAYMENT_METHOD` (`ID_PAYMENT_METHOD`),
  CONSTRAINT `FK_PAYMENT_PAYMENT_METHOD` FOREIGN KEY (`ID_PAYMENT_METHOD`) REFERENCES `payment_method` (`ID_PAYMENT_METHOD`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_PAYMENT_SERVICE_ORDER` FOREIGN KEY (`ID_ORDER`) REFERENCES `service_order` (`ID_ORDER`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_method`
--

DROP TABLE IF EXISTS `payment_method`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_method` (
  `ID_PAYMENT_METHOD` int NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`ID_PAYMENT_METHOD`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_images`
--

DROP TABLE IF EXISTS `product_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_images` (
  `ID_PRODUCT_IMAGE` int NOT NULL,
  `MEDIA_PATH` char(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ID_PRODUCT` int DEFAULT NULL,
  KEY `FK_PRODUCT_IMAGES_INVENTORY` (`ID_PRODUCT`),
  CONSTRAINT `FK_PRODUCT_IMAGES_INVENTORY` FOREIGN KEY (`ID_PRODUCT`) REFERENCES `inventory` (`ID_PRODUCT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resources`
--

DROP TABLE IF EXISTS `resources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resources` (
  `ID_RESOURCE` int NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`ID_RESOURCE`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_appointment`
--

DROP TABLE IF EXISTS `service_appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_appointment` (
  `ID_SERVICE_APPOINTMENT` int NOT NULL AUTO_INCREMENT,
  `START_AT` datetime DEFAULT NULL,
  `END_AT` datetime DEFAULT NULL,
  `STATUS` int DEFAULT NULL,
  `NOTES` varchar(255) DEFAULT NULL,
  `ID_CUSTOMER_MODEL` int DEFAULT NULL,
  PRIMARY KEY (`ID_SERVICE_APPOINTMENT`),
  KEY `CLIENT_MODEL_APPOINTMENT_idx` (`ID_CUSTOMER_MODEL`),
  CONSTRAINT `CLIENT_MODEL_APPOINTMENT` FOREIGN KEY (`ID_CUSTOMER_MODEL`) REFERENCES `customer_model` (`ID_CUSTOMER_MODEL`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_appointment_resources`
--

DROP TABLE IF EXISTS `service_appointment_resources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_appointment_resources` (
  `ID_SERVICE_APPOINTMENT_RESOURCES` int NOT NULL AUTO_INCREMENT,
  `ID_SERVICE_APPOINTMENT` int DEFAULT NULL,
  `ID_RESOURCE` int DEFAULT NULL,
  `ID_TECHNICIAN` int DEFAULT NULL,
  PRIMARY KEY (`ID_SERVICE_APPOINTMENT_RESOURCES`),
  KEY `SERVICE_APPOINTMENT_RESEROUCES_RESOURCES_idx` (`ID_RESOURCE`),
  KEY `SERVICE_APPOINTMENT_RESEROUCES_APPOINTMENT_idx` (`ID_SERVICE_APPOINTMENT`) /*!80000 INVISIBLE */,
  KEY `SERVICE_APPOINTMENT_RESEROUCES_APPOINTMENT_TECHNICIAN_idx` (`ID_TECHNICIAN`),
  CONSTRAINT `SERVICE_APPOINTMENT_RESEROUCES_APPOINTMENT` FOREIGN KEY (`ID_SERVICE_APPOINTMENT`) REFERENCES `service_appointment` (`ID_SERVICE_APPOINTMENT`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SERVICE_APPOINTMENT_RESEROUCES_APPOINTMENT_TECHNICIAN` FOREIGN KEY (`ID_TECHNICIAN`) REFERENCES `technician` (`ID_TECHNICIAN`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SERVICE_APPOINTMENT_RESEROUCES_RESOURCES` FOREIGN KEY (`ID_RESOURCE`) REFERENCES `resources` (`ID_RESOURCE`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_order`
--

DROP TABLE IF EXISTS `service_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_order` (
  `SERVICE_TYPE` int DEFAULT NULL,
  `ID_ORDER` int NOT NULL AUTO_INCREMENT,
  `ID_CUSTOMER_MODEL` int DEFAULT NULL,
  `DATE_TIME_IN` datetime(6) DEFAULT NULL,
  `DATE_TIME_OUT` char(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `PLATE_NUMBER` char(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `VIN` char(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CUSTOMER_NOTES` longtext,
  `INTERNAL_NOTES` longtext,
  `ID_CUSTOMER` int DEFAULT NULL,
  `DIAGNOSIS_NOTES` longtext,
  `ID_TECHNICIAN` int DEFAULT NULL,
  `TOTAL_AMOUNT` decimal(19,4) DEFAULT NULL,
  `DISCOUNT` decimal(19,4) DEFAULT NULL,
  `FINAL_AMOUNT` decimal(19,4) DEFAULT NULL,
  `ODOMETER_READING` bigint DEFAULT NULL,
  `STATUS` int DEFAULT '1',
  PRIMARY KEY (`ID_ORDER`),
  KEY `FK_SERVICE_ORDER_CUSTOMER` (`ID_CUSTOMER`),
  KEY `FK_SERVICE_ORDER_TECHNICIAN` (`ID_TECHNICIAN`),
  KEY `FK_SERVICE_ORDER_CUSTOMER_MODEL` (`ID_CUSTOMER_MODEL`),
  CONSTRAINT `FK_SERVICE_ORDER_CUSTOMER` FOREIGN KEY (`ID_CUSTOMER`) REFERENCES `customer` (`ID_CUSTOMER`),
  CONSTRAINT `FK_SERVICE_ORDER_CUSTOMER_MODEL` FOREIGN KEY (`ID_CUSTOMER_MODEL`) REFERENCES `customer_model` (`ID_CUSTOMER_MODEL`),
  CONSTRAINT `FK_SERVICE_ORDER_TECHNICIAN` FOREIGN KEY (`ID_TECHNICIAN`) REFERENCES `technician` (`ID_TECHNICIAN`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_order_images`
--

DROP TABLE IF EXISTS `service_order_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_order_images` (
  `ID_IMAGE` int NOT NULL AUTO_INCREMENT,
  `ID_ORDER` int DEFAULT NULL,
  `IMAGE_PATH` char(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `VIDEO_PATH` char(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`ID_IMAGE`),
  KEY `FK_SERVICE_ORDER_IMAGES_SERVICE_ORDER` (`ID_ORDER`),
  CONSTRAINT `FK_SERVICE_ORDER_IMAGES_SERVICE_ORDER` FOREIGN KEY (`ID_ORDER`) REFERENCES `service_order` (`ID_ORDER`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_order_products`
--

DROP TABLE IF EXISTS `service_order_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_order_products` (
  `ID_SERVICE_ORDER_PRODUCT` int NOT NULL AUTO_INCREMENT,
  `ID_ORDER` int DEFAULT NULL,
  `ID_PRODUCT` int DEFAULT NULL,
  `QUANTITY` decimal(10,0) DEFAULT NULL,
  PRIMARY KEY (`ID_SERVICE_ORDER_PRODUCT`),
  KEY `FK_SERVICE_ORDER_PRODUCTS_INVENTORY` (`ID_PRODUCT`),
  KEY `FK_SERVICE_ORDER_PRODUCTS_SERVICE_ORDER` (`ID_ORDER`),
  CONSTRAINT `FK_SERVICE_ORDER_PRODUCTS_INVENTORY` FOREIGN KEY (`ID_PRODUCT`) REFERENCES `inventory` (`ID_PRODUCT`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_SERVICE_ORDER_PRODUCTS_SERVICE_ORDER` FOREIGN KEY (`ID_ORDER`) REFERENCES `service_order` (`ID_ORDER`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `ID_SERVICE` int NOT NULL AUTO_INCREMENT,
  `CODE` char(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `HOURS_QUANTITY` decimal(10,0) DEFAULT NULL,
  `UNIT_VALUE` decimal(19,4) DEFAULT NULL,
  `TOTAL_VALUE` decimal(19,4) DEFAULT NULL,
  `ID_ORDER` int DEFAULT NULL,
  `DESCRICAO` char(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ID_TECHNICIAN` int DEFAULT NULL,
  `STATUS` int DEFAULT NULL,
  PRIMARY KEY (`ID_SERVICE`),
  KEY `FK_SERVICES_SERVICE_ORDER` (`ID_ORDER`),
  KEY `FK_SERVICES_TECHNICIAN_idx` (`ID_TECHNICIAN`),
  CONSTRAINT `FK_SERVICES_SERVICE_ORDER` FOREIGN KEY (`ID_ORDER`) REFERENCES `service_order` (`ID_ORDER`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_SERVICES_TECHNICIAN` FOREIGN KEY (`ID_TECHNICIAN`) REFERENCES `technician` (`ID_TECHNICIAN`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `state`
--

DROP TABLE IF EXISTS `state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `state` (
  `ID_STATE` int NOT NULL AUTO_INCREMENT,
  `ID_COUNTRY` int DEFAULT NULL,
  `NAME` char(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ABBREVIATION` char(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`ID_STATE`),
  KEY `FK_STATE_COUNTRY` (`ID_COUNTRY`),
  CONSTRAINT `FK_STATE_COUNTRY` FOREIGN KEY (`ID_COUNTRY`) REFERENCES `country` (`ID_COUNTRY`)
) ENGINE=InnoDB AUTO_INCREMENT=841 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sysdiagrams`
--

DROP TABLE IF EXISTS `sysdiagrams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sysdiagrams` (
  `name` varchar(160) NOT NULL,
  `principal_id` int NOT NULL,
  `diagram_id` int NOT NULL,
  `version` int DEFAULT NULL,
  `definition` longblob,
  PRIMARY KEY (`diagram_id`),
  UNIQUE KEY `UK_principal_name` (`principal_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `technician`
--

DROP TABLE IF EXISTS `technician`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `technician` (
  `ID_TECHNICIAN` int NOT NULL AUTO_INCREMENT,
  `NAME` char(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SALARY` decimal(10,2) DEFAULT NULL,
  `PERCENT` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`ID_TECHNICIAN`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenant_config`
--

DROP TABLE IF EXISTS `tenant_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_config` (
  `ID_TENANT` int NOT NULL AUTO_INCREMENT,
  `NAME` varchar(60) DEFAULT NULL,
  `LEGAL_NAME` varchar(60) DEFAULT NULL,
  `IS_LEGAL_PERSON` tinyint(1) DEFAULT NULL,
  `SEND_WPP` tinyint(1) DEFAULT '0',
  `LOGO_PATH` varchar(255) DEFAULT NULL,
  `BASE_URL_WHATS` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID_TENANT`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unit`
--

DROP TABLE IF EXISTS `unit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `unit` (
  `ID_UNIT` int NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`ID_UNIT`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-22 17:28:57
