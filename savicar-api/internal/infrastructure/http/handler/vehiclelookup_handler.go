package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	appcustomermodel "savicar-api/internal/application/customermodel"
)

// VehicleLookupHandler resolves a plate to vehicle data, checking our own
// records first (customerModelSvc.FindByPlate — free, and the vehicle may
// already be registered) before falling back to the paid wdapi2.com.br
// service, keeping that API key server-side instead of embedding it in the
// Android app (where it could be extracted from the APK).
type VehicleLookupHandler struct {
	customerModelSvc *appcustomermodel.Service
	apiKey           string
	log              *slog.Logger
}

func NewVehicleLookupHandler(customerModelSvc *appcustomermodel.Service) *VehicleLookupHandler {
	key := os.Getenv("WDAPI2_KEY")
	if key == "" {
		key = "a9f858c55d484b678c997fc1e4ae4349"
	}
	return &VehicleLookupHandler{
		customerModelSvc: customerModelSvc,
		apiKey:           key,
		log:              slog.Default().WithGroup("vehiclelookup"),
	}
}

func (h *VehicleLookupHandler) RegisterRoutes(r gin.IRouter) {
	r.GET("/vehicle-lookup/:plate", h.lookup)
}

var plateSanitizeRe = regexp.MustCompile(`[^A-Za-z0-9]`)

type wdapi2FipeItem struct {
	TextoMarca string `json:"texto_marca"`
}

type wdapi2Fipe struct {
	Dados []wdapi2FipeItem `json:"dados"`
}

type wdapi2Extra struct {
	Chassi string `json:"chassi"`
}

type wdapi2Response struct {
	Marca           string      `json:"marca"`
	Modelo          string      `json:"modelo"`
	SubModelo       string      `json:"SUBMODELO"`
	Versao          string      `json:"VERSAO"`
	Ano             string      `json:"ano"`
	AnoModelo       string      `json:"anoModelo"`
	Cor             string      `json:"cor"`
	Placa           string      `json:"placa"`
	Chassi          string      `json:"chassi"`
	Extra           wdapi2Extra `json:"extra"`
	Fipe            wdapi2Fipe  `json:"fipe"`
	MensagemRetorno string      `json:"mensagemRetorno"`
}

// VehicleLookupResponse is the normalized shape returned to callers (Android
// app and web frontend). Source tells the caller which path answered: "local"
// means IDModel is already the exact catalog id (no brand/model text matching
// needed); "external" means Brand/Model/SubModel are free text from the paid
// lookup service and still need matching against the make/model catalog.
type VehicleLookupResponse struct {
	Plate     string `json:"plate"`
	Brand     string `json:"brand"`
	Model     string `json:"model"`
	SubModel  string `json:"sub_model"`
	Version   string `json:"version"`
	YearMake  string `json:"year_make"`
	YearModel string `json:"year_model"`
	Color     string `json:"color"`
	Chassis   string `json:"chassis"`
	Source    string `json:"source"`
	IDModel   *int   `json:"id_model,omitempty"`
}

func (h *VehicleLookupHandler) lookup(c *gin.Context) {
	plate := strings.ToUpper(plateSanitizeRe.ReplaceAllString(c.Param("plate"), ""))
	if plate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "placa inválida"})
		return
	}

	if cm, err := h.customerModelSvc.FindByPlate(c.Request.Context(), plate); err != nil {
		h.log.Error("local plate check failed", slog.String("plate", plate), slog.Any("error", err))
	} else if cm != nil {
		model := ""
		if cm.ModelName != nil {
			model = *cm.ModelName
		}
		color := ""
		if cm.Color != nil {
			color = *cm.Color
		}
		chassis := ""
		if cm.VIN != nil {
			chassis = *cm.VIN
		}
		yearMake := ""
		if cm.YearMake != nil {
			yearMake = strconv.Itoa(*cm.YearMake)
		}
		yearModel := ""
		if cm.YearModel != nil {
			yearModel = strconv.Itoa(*cm.YearModel)
		}
		idModel := cm.IDModel
		c.JSON(http.StatusOK, VehicleLookupResponse{
			Plate:     plate,
			Model:     model,
			YearMake:  yearMake,
			YearModel: yearModel,
			Color:     color,
			Chassis:   chassis,
			Source:    "local",
			IDModel:   &idModel,
		})
		return
	}

	url := fmt.Sprintf("https://wdapi2.com.br/consulta/%s/%s", plate, h.apiKey)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.log.Error("wdapi2 request failed", slog.String("plate", plate), slog.Any("error", err))
		c.JSON(http.StatusBadGateway, gin.H{"error": "serviço de consulta de placa indisponível"})
		return
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if resp.StatusCode >= 400 {
		h.log.Error("wdapi2 error response", slog.String("plate", plate), slog.Int("status", resp.StatusCode), slog.String("body", string(raw)))
		c.JSON(http.StatusBadGateway, gin.H{"error": "consulta de placa falhou"})
		return
	}

	var parsed wdapi2Response
	if err := json.Unmarshal(raw, &parsed); err != nil {
		h.log.Error("wdapi2 parse failed", slog.String("plate", plate), slog.String("body", string(raw)))
		c.JSON(http.StatusBadGateway, gin.H{"error": "resposta inválida da consulta de placa"})
		return
	}

	if parsed.Placa == "" && parsed.Modelo == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "veículo não encontrado para esta placa"})
		return
	}

	brand := parsed.Marca
	if len(parsed.Fipe.Dados) > 0 && parsed.Fipe.Dados[0].TextoMarca != "" {
		brand = parsed.Fipe.Dados[0].TextoMarca
	}
	chassis := parsed.Chassi
	if parsed.Extra.Chassi != "" {
		chassis = parsed.Extra.Chassi
	}

	c.JSON(http.StatusOK, VehicleLookupResponse{
		Plate:     plate,
		Brand:     brand,
		Model:     parsed.Modelo,
		SubModel:  parsed.SubModelo,
		Version:   parsed.Versao,
		YearMake:  parsed.Ano,
		YearModel: parsed.AnoModelo,
		Color:     parsed.Cor,
		Chassis:   chassis,
		Source:    "external",
	})
}
