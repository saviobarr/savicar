package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	notificationsvc "savicar-api/internal/application/notification"
)

type NotificationHandler struct {
	svc *notificationsvc.Service
}

func NewNotificationHandler(svc *notificationsvc.Service) *NotificationHandler {
	return &NotificationHandler{svc: svc}
}

func (h *NotificationHandler) RegisterRoutes(r gin.IRouter) {
	g := r.Group("/notifications")
	g.GET("", h.list)
	g.GET("/unread-count", h.unreadCount)
	g.PUT("/:id/read", h.markRead)
	g.PUT("/read-all", h.markAllRead)
}

// @Summary     List notifications for the logged-in user
// @Tags        notifications
// @Produce     json
// @Success     200 {array}  notification.Notification
// @Failure     500 {object} map[string]string
// @Router      /notifications [get]
func (h *NotificationHandler) list(c *gin.Context) {
	items, err := h.svc.ListByUser(c.Request.Context(), contextInt(c, "user_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

// @Summary     Count unread notifications for the logged-in user
// @Tags        notifications
// @Produce     json
// @Success     200 {object} map[string]int
// @Failure     500 {object} map[string]string
// @Router      /notifications/unread-count [get]
func (h *NotificationHandler) unreadCount(c *gin.Context) {
	count, err := h.svc.CountUnread(c.Request.Context(), contextInt(c, "user_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// @Summary     Mark one notification as read
// @Tags        notifications
// @Param       id  path int true "Notification ID"
// @Success     204
// @Failure     400 {object} map[string]string
// @Failure     500 {object} map[string]string
// @Router      /notifications/{id}/read [put]
func (h *NotificationHandler) markRead(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.svc.MarkRead(c.Request.Context(), id, contextInt(c, "user_id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// @Summary     Mark all notifications as read for the logged-in user
// @Tags        notifications
// @Success     204
// @Failure     500 {object} map[string]string
// @Router      /notifications/read-all [put]
func (h *NotificationHandler) markAllRead(c *gin.Context) {
	if err := h.svc.MarkAllRead(c.Request.Context(), contextInt(c, "user_id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
