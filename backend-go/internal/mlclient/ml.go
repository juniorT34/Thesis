package mlclient

import (
	"bytes"
	"encoding/json"
	"net/http"
	"backend/internal/models"
)

func PredictPhishing(text string) (models.PhishingCheckResponse, error) {
	var result models.PhishingCheckResponse
	reqBody, _ := json.Marshal(models.PhishingCheckRequest{Text:text})

	resp, err := http.Post("http://ml-inference:8080/predict", "application/json", bytes.NewBuffer(reqBody))

	if err != nil {
		return result, err 
	}

	defer resp.Body.Close()

	if err := json.NewDecoder(resp.Body).Decode((&result)); err != nil {
		return result, err
	}

	return result, nil 
}