output "api_gateway_probe_paths" {
  description = "HTTP paths used for Kubernetes probes"
  value = {
    readiness = "/readyz"
    liveness  = "/healthz"
  }
}
