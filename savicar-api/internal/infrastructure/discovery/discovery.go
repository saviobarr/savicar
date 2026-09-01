package discovery

import (
	"fmt"
	"log/slog"
	"net"
)

const (
	discoveryPort = 9999
	discoverMsg   = "SAVICAR_DISCOVER"
	responsePfx   = "SAVICAR_HERE:"
)

// StartDiscoveryListener escuta broadcasts UDP e responde com a porta da API.
// apiPort é a porta onde o backend HTTP está rodando (ex: 8080).
func StartDiscoveryListener(apiPort int) error {
	addr := net.UDPAddr{
		Port: discoveryPort,
		IP:   net.IPv4zero, // escuta em todas as interfaces
	}

	conn, err := net.ListenUDP("udp4", &addr)
	if err != nil {
		return fmt.Errorf("failed to start discovery listener: %w", err)
	}

	slog.Info("discovery listener started", "port", discoveryPort)

	go func() {
		defer conn.Close()
		buf := make([]byte, 1024)

		for {
			n, clientAddr, err := conn.ReadFromUDP(buf)
			if err != nil {
				slog.Error("discovery read error", "error", err)
				continue
			}

			msg := string(buf[:n])
			if msg != discoverMsg {
				continue // ignora pacotes desconhecidos
			}

			response := fmt.Sprintf("%s%d", responsePfx, apiPort)
			_, err = conn.WriteToUDP([]byte(response), clientAddr)
			if err != nil {
				slog.Error("discovery response error", "error", err, "client", clientAddr)
				continue
			}

			slog.Info("discovery request answered", "client", clientAddr.IP.String())
		}
	}()

	return nil
}
