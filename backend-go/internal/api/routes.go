package api

import (
	"backend/internal/api/handlers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.Engine) {
	//health check endpoint
	router.GET("/health", handlers.HealthCheck)
	//other api endpoints can be registerer here
	router.POST("/api/v1/phishing-check", handlers.PhishingCheck())

	//add browser/desktop container endpoint later
	router.POST("/api/v1/browser/start", handlers.StartBrowserHandler)
	router.POST("/api/v1/browser/stop/:sessionId", handlers.StopBrowserHandler)
}