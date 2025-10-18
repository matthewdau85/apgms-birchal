resource "kubernetes_deployment" "api_gateway" {
  metadata {
    name = "api-gateway"
    labels = {
      app = "api-gateway"
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "api-gateway"
      }
    }

    template {
      metadata {
        labels = {
          app = "api-gateway"
        }
      }

      spec {
        termination_grace_period_seconds = 45

        container {
          name  = "api-gateway"
          image = var.api_gateway_image

          port {
            name           = "http"
            container_port = 3000
          }

          env {
            name  = "PORT"
            value = "3000"
          }

          readiness_probe {
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 2

            http_get {
              path = "/readyz"
              port = 3000
            }
          }

          liveness_probe {
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 2

            http_get {
              path = "/healthz"
              port = 3000
            }
          }

          lifecycle {
            pre_stop {
              exec {
                command = ["/bin/sh", "-c", "sleep 5"]
              }
            }
          }
        }
      }
    }
  }
}
