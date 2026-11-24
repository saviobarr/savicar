package nfse

import "context"

// InvoiceClient is a port to the external NFS-e issuing hub (Focus NFe).
// Issuance is asynchronous: CreateServiceInvoice enqueues the DPS under the
// given reference and returns immediately with a "processing" status;
// GetServiceInvoiceStatus is polled with that same reference until the hub
// returns a terminal status (authorized or rejected).
// cliente, when known, is the tomador's razão social — carried through
// purely so a failure log can say which customer's DPS it was, without the
// domain layer needing to know anything about logging itself.
type InvoiceClient interface {
	CreateServiceInvoice(ctx context.Context, apiKey, ref, cliente string, payload []byte) (statusCode int, body []byte, curl string, err error)
	GetServiceInvoiceStatus(ctx context.Context, apiKey, ref, cliente string) (statusCode int, body []byte, curl string, err error)
}

// PrestadorContato carries the tenant contact fields the DPS payload itself
// doesn't include but the DANFSe preview layout shows.
type PrestadorContato struct {
	NomeFantasia string
	Telefone     string
	Email        string
	Endereco     string
	ZipCode      string
}

// PdfPreviewRenderer builds a draft PDF of a DPS in the DANFSe layout
// before it is submitted to Focus NFe, so the user can review it before
// confirming the emission. Fields only known after real authorization
// (chave de acesso, QR code, número da NFS-e, situação) are shown pending.
type PdfPreviewRenderer interface {
	RenderPreview(payload []byte, prestador PrestadorContato) ([]byte, error)
}
