variable "api_gateway_image" {
  description = "Container image for the API gateway deployment"
  type        = string
  default     = "ghcr.io/apgms/api-gateway:latest"
}
