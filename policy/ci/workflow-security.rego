package ci.workflowsecurity

deny[msg] {
  metadata := input.metadata
  contents := input.content
  endswith(metadata.filename, ".yml")
  not contents.permissions
  msg := sprintf("%s: workflow must explicitly set permissions", [metadata.filename])
}

deny[msg] {
  contents := input.content
  perms := contents.permissions
  perms[perm] == "write"
  perm != "contents"
  perm != "id-token"
  perm != "attestations"
  perm != "security-events"
  perm != "pull-requests"
  msg := sprintf("workflow permission %s must not be write", [perm])
}
