package models

type PhishingCheckRequest struct {
	Text string `json: "text" binding: "required"`
}

type PhishingCheckResponse struct {
	PhishingProbability float64 `json: "phishing_probability"`
	Prediction string `json:"prediction"`
}