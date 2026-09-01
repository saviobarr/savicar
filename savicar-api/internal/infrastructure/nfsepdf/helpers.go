// Package nfsepdf renders a preview of the DANFSe (Documento Auxiliar da
// NFS-e, layout v2.0 used by Focus NFe / Sistema Nacional da NFS-e) from a
// draft DPS payload, before it is submitted for real authorization.
package nfsepdf

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/text/encoding/charmap"
)

var digitsOnly = regexp.MustCompile(`\D`)

func onlyDigits(s string) string {
	return digitsOnly.ReplaceAllString(s, "")
}

// latin converts a UTF-8 string to ISO-8859-1 for fpdf, falling back to "-"
// when empty and "?" for characters outside Latin-1.
func latin(s string) string {
	if strings.TrimSpace(s) == "" {
		s = "-"
	}
	encoded, err := charmap.ISO8859_1.NewEncoder().String(s)
	if err != nil {
		var buf strings.Builder
		enc := charmap.ISO8859_1.NewEncoder()
		for _, r := range s {
			b, err := enc.String(string(r))
			if err != nil {
				buf.WriteByte('?')
			} else {
				buf.WriteString(b)
			}
		}
		return buf.String()
	}
	return encoded
}

func formatCpfCnpj(v string) string {
	d := onlyDigits(v)
	switch len(d) {
	case 14:
		return d[0:2] + "." + d[2:5] + "." + d[5:8] + "/" + d[8:12] + "-" + d[12:14]
	case 11:
		return d[0:3] + "." + d[3:6] + "." + d[6:9] + "-" + d[9:11]
	default:
		return v
	}
}

func formatCep(cep string) string {
	d := onlyDigits(cep)
	if len(d) != 8 {
		return cep
	}
	return d[0:5] + "-" + d[5:8]
}

func fmtBRL(v float64) string {
	return fmt.Sprintf("R$ %.2f", v)
}

func parseValor(v string) float64 {
	f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
	if err != nil {
		return 0
	}
	return f
}

// formatDataHora converts "2026-09-01T07:34:00-03:00" (or without the
// offset) into "01/09/2026 07:34".
func formatDataHora(v string) string {
	v = strings.ReplaceAll(v, "T", " ")
	if len(v) < 16 {
		return v
	}
	d := strings.Split(v[:10], "-")
	if len(d) != 3 {
		return v
	}
	return d[2] + "/" + d[1] + "/" + d[0] + " " + v[11:16]
}

// formatDataOnly converts "2026-09-01" into "01/09/2026".
func formatDataOnly(v string) string {
	if len(v) < 10 {
		return v
	}
	d := strings.Split(v[:10], "-")
	if len(d) != 3 {
		return v
	}
	return d[2] + "/" + d[1] + "/" + d[0]
}

// municipioInfo resolves an IBGE municipality code to its name and UF via
// the public IBGE "localidades" API, with an in-memory cache and a short
// timeout — best-effort only, callers fall back to the raw code when the
// lookup fails or the network is unavailable.
var municipioCache sync.Map

var ibgeHTTPClient = &http.Client{Timeout: 4 * time.Second}

type municipioData struct {
	Nome string
	UF   string
}

func municipioInfo(codigo string) municipioData {
	codigo = strings.TrimSpace(codigo)
	if codigo == "" {
		return municipioData{}
	}
	if v, ok := municipioCache.Load(codigo); ok {
		return v.(municipioData)
	}

	resp, err := ibgeHTTPClient.Get("https://servicodados.ibge.gov.br/api/v1/localidades/municipios/" + url.PathEscape(codigo))
	if err != nil {
		return municipioData{}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return municipioData{}
	}

	var m struct {
		Nome         string `json:"nome"`
		Microrregiao struct {
			Mesorregiao struct {
				UF struct {
					Sigla string `json:"sigla"`
				} `json:"UF"`
			} `json:"mesorregiao"`
		} `json:"microrregiao"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil || m.Nome == "" {
		return municipioData{}
	}

	data := municipioData{Nome: m.Nome, UF: m.Microrregiao.Mesorregiao.UF.Sigla}
	municipioCache.Store(codigo, data)
	return data
}

func municipioUF(codigo string) string {
	info := municipioInfo(codigo)
	if info.Nome == "" {
		return codigo
	}
	if info.UF == "" {
		return info.Nome
	}
	return info.Nome + " / " + info.UF
}
