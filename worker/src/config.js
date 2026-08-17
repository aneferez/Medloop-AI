// Central runtime configuration derived from the Worker environment bindings.
export function loadConfig(env) {
  return {
    environment: env.ENVIRONMENT || 'development',
    apiVersion: env.API_VERSION || 'v1',
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    tokenSigningSecret: env.TOKEN_SIGNING_SECRET || '',
    hasFiles: Boolean(env.FILES),
  }
}

// "*" (or empty) => allow any origin; otherwise an explicit allow-list.
function parseOrigins(value) {
  if (!value || value.trim() === '*') return '*'
  return value.split(',').map((origin) => origin.trim()).filter(Boolean)
}
