package erroralert

import (
	"context"
	"log/slog"
)

// Handler wraps another slog.Handler and, in addition to delegating to it
// as normal, notifies a Sender for every Error-level (or higher) record.
// Every existing slog.ErrorContext call across the app (see CLAUDE.md:
// "Logging uses the standard log/slog package") becomes a WhatsApp alert
// for free: the logger's group chain (e.g. "service.nfse", set via
// WithGroup at construction, see focusnfe_client.go) stands in for the
// affected operation, and whatever attrs the call site already logs (ref,
// order_id, ...) stand in for the affected client/record.
type Handler struct {
	next      slog.Handler
	sender    *Sender
	groupPath string
	attrs     []slog.Attr
}

func Wrap(next slog.Handler, sender *Sender) *Handler {
	return &Handler{next: next, sender: sender}
}

func (h *Handler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.next.Enabled(ctx, level)
}

func (h *Handler) Handle(ctx context.Context, r slog.Record) error {
	err := h.next.Handle(ctx, r)
	if r.Level >= slog.LevelError {
		attrs := make([]slog.Attr, 0, len(h.attrs)+r.NumAttrs())
		attrs = append(attrs, h.attrs...)
		r.Attrs(func(a slog.Attr) bool {
			attrs = append(attrs, a)
			return true
		})
		h.sender.Notify(h.groupPath, r.Message, attrs)
	}
	return err
}

func (h *Handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &Handler{
		next:      h.next.WithAttrs(attrs),
		sender:    h.sender,
		groupPath: h.groupPath,
		attrs:     append(append([]slog.Attr{}, h.attrs...), attrs...),
	}
}

func (h *Handler) WithGroup(name string) slog.Handler {
	path := name
	if h.groupPath != "" {
		path = h.groupPath + "." + name
	}
	return &Handler{
		next:      h.next.WithGroup(name),
		sender:    h.sender,
		groupPath: path,
		attrs:     h.attrs,
	}
}
