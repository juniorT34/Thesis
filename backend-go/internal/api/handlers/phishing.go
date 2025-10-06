package handlers

import (
	"backend/internal/mlclient"
	"backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// PhishingCheck receives text input. calls ML service, and returns result
func PhishingCheck(c *gin.Context) {
	var req models.PhishingCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request payload",
		})
		return 
	}

	result, err := mlclient.PredictPhishing(req.Text)
	if err != nil {
		c.JSON(http.StatusInternalServerError,gin.H{
			"error": "ML service error",
		})
		return 
	}

	c.JSON(http.StatusOK, result)
}