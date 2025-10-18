package kubernetes.securecontainers

deny[msg] {
  input.metadata.kind == "Deployment"
  container := input.content.spec.template.spec.containers[_]
  not container.securityContext.runAsNonRoot
  msg := sprintf("%s: container %s must runAsNonRoot", [input.metadata.name, container.name])
}

deny[msg] {
  input.metadata.kind == "Deployment"
  container := input.content.spec.template.spec.containers[_]
  not container.securityContext.readOnlyRootFilesystem
  msg := sprintf("%s: container %s must enable readOnlyRootFilesystem", [input.metadata.name, container.name])
}

deny[msg] {
  input.metadata.kind == "Deployment"
  container := input.content.spec.template.spec.containers[_]
  not startswith(container.image, "ghcr.io/apgms/")
  msg := sprintf("%s: container %s must use hardened ghcr.io/apgms image", [input.metadata.name, container.name])
}
