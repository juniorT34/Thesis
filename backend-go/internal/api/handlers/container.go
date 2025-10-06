package handlers

import (
	 "net/http"
    "backend/internal/models"
    "backend/internal/containers"
    "github.com/gin-gonic/gin"
)

// StartBrowser starts a disposable browser container and returns URL
func StartBrowserHandler(c *gin.Context){
	var req models.ContainerStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error":"Invalid request"})
		
		return 
	}

	url, err := containers.StartBrowserContainer(req.SessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start browser container"})
		return 
	}

	c.JSON(http.StatusOK, gin.H{"access_url": url})
}

// StopBrowser stops the browser container by session ID
func StopBrowserHandler(c *gin.Context){
	sessionId := c.Param("sessionId")
	if err := containers.StopBrowserContainer(sessionId); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error":"Failed to stop browser container"})
		return 
	}

	c.JSON(http.StatusOK, gin.H{"message": "Browser container stopped"})
}