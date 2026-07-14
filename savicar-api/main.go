// @title           Savicar API
// @version         1.0
// @description     Service Order Images API
// @host            localhost:8080
// @BasePath        /
package main

import (
	"embed"
	"io"
	"io/fs"
	"log"
	"log/slog"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"savicar-api/db"
	_ "savicar-api/docs"
	appcity "savicar-api/internal/application/city"
	apptenantconfig "savicar-api/internal/application/tenantconfig"
	appcontact "savicar-api/internal/application/contact"
	appcostcategory "savicar-api/internal/application/costcategory"
	appcountry "savicar-api/internal/application/country"
	appcustomer "savicar-api/internal/application/customer"
	appcustomermodel "savicar-api/internal/application/customermodel"
	appfinancialreport "savicar-api/internal/application/financialreport"
	appfuel "savicar-api/internal/application/fuel"
	appinventory "savicar-api/internal/application/inventory"
	appoperationalcosts "savicar-api/internal/application/operationalcosts"
	apppayment "savicar-api/internal/application/payment"
	apppaymentmethod "savicar-api/internal/application/paymentmethod"
	appproductimage "savicar-api/internal/application/productimage"
	appresource "savicar-api/internal/application/resource"
	appserviceappointment "savicar-api/internal/application/serviceappointment"
	appsar "savicar-api/internal/application/serviceappointmentresource"
	appserviceorder "savicar-api/internal/application/serviceorder"
	appsvc "savicar-api/internal/application/serviceorderimage"
	appserviceorderproducts "savicar-api/internal/application/serviceorderproducts"
	appservices "savicar-api/internal/application/services"
	appstate "savicar-api/internal/application/state"
	apptechnician "savicar-api/internal/application/technician"
	appunity "savicar-api/internal/application/unity"
	appuser "savicar-api/internal/application/user"
	appvehiclemake "savicar-api/internal/application/vehiclemake"
	appvehiclemodel "savicar-api/internal/application/vehiclemodel"
	"savicar-api/icon"
	"savicar-api/internal/infrastructure/http/handler"
	"savicar-api/internal/infrastructure/http/middleware"
	"savicar-api/internal/infrastructure/externallookup"
	"savicar-api/internal/infrastructure/persistence"
	"savicar-api/internal/infrastructure/storage"
	"github.com/getlantern/systray"
)

//go:embed dist
var embeddedDist embed.FS

func serveEmbedded(c *gin.Context, subFS fs.FS, path string) {
	data, err := fs.ReadFile(subFS, path)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	mimeType := mime.TypeByExtension(filepath.Ext(path))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	c.Data(http.StatusOK, mimeType, data)
}

const uploadBasePath = "/home/savio/savicar-img"

// setupLogging writes slog output to both stderr and a log file next to the
// running executable. The packaged .exe is built with -H windowsgui (no
// console window), so without this, errors are otherwise invisible once deployed.
func setupLogging() *os.File {
	exePath, err := os.Executable()
	logPath := "savicar-api.log"
	if err == nil {
		logPath = filepath.Join(filepath.Dir(exePath), "savicar-api.log")
	}

	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("could not open log file %s: %v (logging to stderr only)", logPath, err)
		return nil
	}

	writer := io.MultiWriter(os.Stderr, logFile)
	slog.SetDefault(slog.New(slog.NewTextHandler(writer, nil)))
	log.SetOutput(writer)
	return logFile
}

func main() {
	if logFile := setupLogging(); logFile != nil {
		defer logFile.Close()
	}

	conn, err := db.ConnectDb()
	if err != nil {
		log.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close()

	// Service Order Images
	repo := persistence.NewSQLServerServiceOrderImageRepository(conn)
	svc := appsvc.NewService(repo)
	fileStorage := storage.NewLocalFileStorage(uploadBasePath)
	h := handler.NewServiceOrderImageHandler(svc, fileStorage, uploadBasePath)

	// Product Images
	productImageRepo := persistence.NewSQLServerProductImageRepository(conn)
	productImageSvc := appproductimage.NewService(productImageRepo)
	productImageHandler := handler.NewProductImageHandler(productImageSvc, fileStorage, uploadBasePath)

	// Vehicle Make
	vehicleMakeRepo := persistence.NewSQLServerVehicleMakeRepository(conn)
	vehicleMakeSvc := appvehiclemake.NewService(vehicleMakeRepo)
	vehicleMakeHandler := handler.NewVehicleMakeHandler(vehicleMakeSvc)

	// Fuel
	fuelRepo := persistence.NewSQLServerFuelRepository(conn)
	fuelSvc := appfuel.NewService(fuelRepo)
	fuelHandler := handler.NewFuelHandler(fuelSvc)

	// Technician
	technicianRepo := persistence.NewSQLServerTechnicianRepository(conn)
	technicianSvc := apptechnician.NewService(technicianRepo)
	technicianHandler := handler.NewTechnicianHandler(technicianSvc)

	// Vehicle Model
	vehicleModelRepo := persistence.NewSQLServerVehicleModelRepository(conn)
	vehicleModelSvc := appvehiclemodel.NewService(vehicleModelRepo)
	vehicleModelHandler := handler.NewVehicleModelHandler(vehicleModelSvc)

	// Customer
	customerRepo := persistence.NewSQLServerCustomerRepository(conn)
	customerSvc := appcustomer.NewService(customerRepo)
	customerHandler := handler.NewCustomerHandler(customerSvc)

	// Contact
	contactRepo := persistence.NewSQLServerContactRepository(conn)
	contactSvc := appcontact.NewService(contactRepo)
	contactHandler := handler.NewContactHandler(contactSvc)

	// Customer Model
	customerModelRepo := persistence.NewSQLServerCustomerModelRepository(conn)
	customerModelSvc := appcustomermodel.NewService(customerModelRepo)
	customerModelHandler := handler.NewCustomerModelHandler(customerModelSvc)

	// Inventory
	inventoryRepo := persistence.NewSQLServerInventoryRepository(conn)
	inventorySvc := appinventory.NewService(inventoryRepo, externallookup.NewChainLookup(
		externallookup.NewCosmosClient(),
		externallookup.NewUPCItemDBClient(),
	))
	inventoryHandler := handler.NewInventoryHandler(inventorySvc)

	// Unity
	unityRepo := persistence.NewSQLServerUnityRepository(conn)
	unitySvc := appunity.NewService(unityRepo)
	unityHandler := handler.NewUnityHandler(unitySvc)

	// Resource
	resourceRepo := persistence.NewSQLServerResourceRepository(conn)
	resourceSvc := appresource.NewService(resourceRepo)
	resourceHandler := handler.NewResourceHandler(resourceSvc)

	// Service Appointment Resource (created first so it can be injected into SA service)
	sarRepo := persistence.NewSQLServerServiceAppointmentResourceRepository(conn)
	sarSvc := appsar.NewService(sarRepo)
	sarHandler := handler.NewServiceAppointmentResourceHandler(sarSvc)

	// Service Appointment
	serviceAppointmentRepo := persistence.NewSQLServerServiceAppointmentRepository(conn)
	serviceAppointmentSvc := appserviceappointment.NewService(serviceAppointmentRepo, sarRepo)
	serviceAppointmentHandler := handler.NewServiceAppointmentHandler(serviceAppointmentSvc)

	// Service Order (wired after products repo below)
	serviceOrderRepo := persistence.NewSQLServerServiceOrderRepository(conn)

	// Services
	servicesRepo := persistence.NewSQLServerServicesRepository(conn)
	servicesSvc := appservices.NewService(servicesRepo)
	servicesHandler := handler.NewServicesHandler(servicesSvc)

	// Service Order Products
	serviceOrderProductsRepo := persistence.NewSQLServerServiceOrderProductsRepository(conn)
	serviceOrderProductsSvc := appserviceorderproducts.NewService(serviceOrderProductsRepo, inventoryRepo, serviceOrderRepo)
	serviceOrderProductsHandler := handler.NewServiceOrderProductsHandler(serviceOrderProductsSvc)

	// Service Order service wired after products repo
	serviceOrderSvc := appserviceorder.NewService(serviceOrderRepo, serviceOrderProductsRepo, inventoryRepo)
	serviceOrderHandler := handler.NewServiceOrderHandler(serviceOrderSvc)

	// Payment Method
	paymentMethodRepo := persistence.NewSQLServerPaymentMethodRepository(conn)
	paymentMethodSvc := apppaymentmethod.NewService(paymentMethodRepo)
	paymentMethodHandler := handler.NewPaymentMethodHandler(paymentMethodSvc)

	// Payment
	paymentRepo := persistence.NewSQLServerPaymentRepository(conn)
	paymentSvc := apppayment.NewService(paymentRepo)
	paymentHandler := handler.NewPaymentHandler(paymentSvc)

	// Country
	countryRepo := persistence.NewSQLServerCountryRepository(conn)
	countrySvc := appcountry.NewService(countryRepo)
	countryHandler := handler.NewCountryHandler(countrySvc)

	// State
	stateRepo := persistence.NewSQLServerStateRepository(conn)
	stateSvc := appstate.NewService(stateRepo)
	stateHandler := handler.NewStateHandler(stateSvc)

	// Financial Report
	financialReportRepo := persistence.NewFinancialReportRepository(conn)
	financialReportSvc := appfinancialreport.NewService(financialReportRepo)
	financialReportHandler := handler.NewFinancialReportHandler(financialReportSvc)

	// Cost Category
	costCategoryRepo := persistence.NewSQLServerCostCategoryRepository(conn)
	costCategorySvc := appcostcategory.NewService(costCategoryRepo)
	costCategoryHandler := handler.NewCostCategoryHandler(costCategorySvc)

	// Operational Costs
	operationalCostsRepo := persistence.NewSQLServerOperationalCostsRepository(conn)
	operationalCostsSvc := appoperationalcosts.NewService(operationalCostsRepo)
	operationalCostsHandler := handler.NewOperationalCostsHandler(operationalCostsSvc)

	// City
	cityRepo := persistence.NewSQLServerCityRepository(conn)
	citySvc := appcity.NewService(cityRepo)
	cityHandler := handler.NewCityHandler(citySvc)

	// Users
	userRepo := persistence.NewSQLServerUserRepository(conn)
	userSvc := appuser.NewService(userRepo)
	userHandler := handler.NewUserHandler(userSvc)

	// Tenant Config
	tenantConfigRepo := persistence.NewSQLServerTenantConfigRepository(conn)
	tenantConfigSvc := apptenantconfig.NewService(tenantConfigRepo)
	tenantConfigHandler := handler.NewTenantConfigHandler(tenantConfigSvc)
	whatsAppHandler := handler.NewWhatsAppHandler(tenantConfigSvc, serviceOrderSvc, paymentSvc, citySvc, stateSvc, conn)

	r := gin.Default()
	r.SetTrustedProxies(nil)
	r.Use(cors.New(cors.Config{
		AllowAllOrigins: true,
		AllowMethods:    []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:    []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:   []string{"Content-Disposition"},
	}))

	// ── Public routes (no auth) ──────────────────────────────────
	handler.RegisterAuthRoutes(r, conn)
	tenantConfigHandler.RegisterPublicRoutes(r)
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Frontend static files served from embedded FS — no auth needed.
	// Uses fs.ReadFile + c.Data to avoid http.FileServer redirect loops.
	subFS, _ := fs.Sub(embeddedDist, "dist")

	r.GET("/assets/*filepath", func(c *gin.Context) {
		serveEmbedded(c, subFS, "assets"+c.Param("filepath"))
	})
	// SPA fallback: serve the file if it exists, otherwise index.html.
	r.NoRoute(func(c *gin.Context) {
		path := strings.TrimPrefix(c.Request.URL.Path, "/")
		if path != "" {
			if _, err := fs.Stat(subFS, path); err == nil {
				serveEmbedded(c, subFS, path)
				return
			}
		}
		data, _ := fs.ReadFile(subFS, "index.html")
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})

	// ── Protected API routes (require valid JWT) ─────────────────
	auditRepo := persistence.NewSQLAuditRepository(conn)
	auditHandler := handler.NewAuditHandler(auditRepo)

	indexHTML, _ := fs.ReadFile(subFS, "index.html")

	api := r.Group("")
	api.Use(middleware.Auth(indexHTML))
	api.Use(middleware.Audit(auditRepo))

	h.RegisterRoutes(api)
	productImageHandler.RegisterRoutes(api)
	vehicleMakeHandler.RegisterRoutes(api)
	fuelHandler.RegisterRoutes(api)
	technicianHandler.RegisterRoutes(api)
	vehicleModelHandler.RegisterRoutes(api)
	customerHandler.RegisterRoutes(api)
	contactHandler.RegisterRoutes(api)
	customerModelHandler.RegisterRoutes(api)
	inventoryHandler.RegisterRoutes(api)
	unityHandler.RegisterRoutes(api)
	resourceHandler.RegisterRoutes(api)
	serviceAppointmentHandler.RegisterRoutes(api)
	sarHandler.RegisterRoutes(api)
	serviceOrderHandler.RegisterRoutes(api)
	servicesHandler.RegisterRoutes(api)
	serviceOrderProductsHandler.RegisterRoutes(api)
	paymentMethodHandler.RegisterRoutes(api)
	paymentHandler.RegisterRoutes(api)
	countryHandler.RegisterRoutes(api)
	stateHandler.RegisterRoutes(api)
	cityHandler.RegisterRoutes(api)
	operationalCostsHandler.RegisterRoutes(api)
	costCategoryHandler.RegisterRoutes(api)
	financialReportHandler.RegisterRoutes(api)
	tenantConfigHandler.RegisterRoutes(api)
	whatsAppHandler.RegisterRoutes(api)
	userHandler.RegisterRoutes(api)
	auditHandler.RegisterRoutes(api)

	// Start HTTP server in background
	go func() {
		if err := r.Run(":8080"); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Open browser once the server is ready
	go func() {
		for {
			resp, err := http.Get("http://localhost:8080/index.html")
			if err == nil {
				resp.Body.Close()
				exec.Command("cmd", "/c", "start", "http://localhost:8080").Start()
				return
			}
			time.Sleep(200 * time.Millisecond)
		}
	}()

	// System tray icon — right-click to open browser or quit
	systray.Run(func() {
		systray.SetIcon(icon.Load())
		systray.SetTitle("Savicar")
		systray.SetTooltip("Savicar — servidor rodando em localhost:8080")

		mOpen := systray.AddMenuItem("Abrir no navegador", "Abre o sistema no navegador padrão")
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("Encerrar", "Para o servidor e fecha o aplicativo")

		for {
			select {
			case <-mOpen.ClickedCh:
				exec.Command("cmd", "/c", "start", "http://localhost:8080").Start()
			case <-mQuit.ClickedCh:
				systray.Quit()
				os.Exit(0)
			}
		}
	}, nil)
}
