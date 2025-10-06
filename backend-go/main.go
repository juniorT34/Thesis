package main 

import (
    "github.com/gin-gonic/gin"
    "backend/internal/api"
    "log"
)

func main(){
    //initiale Gin router with default logger and recovery middleware
    router := gin.Default()
    // register application routes
    api.RegisterRoutes(router)
    //Start HTTP server on port 8080
    if err := router.Run(":8080"); err != nil {
        log.Fatalf("Unable to start server : %v", err)
    }
}