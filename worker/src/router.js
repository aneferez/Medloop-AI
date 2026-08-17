// Minimal method + path router with :param capture. Paths are matched after the
// "/<apiVersion>" prefix has been stripped by the gateway.
export class Router {
  constructor() {
    this.routes = []
  }

  add(method, pattern, handler) {
    const segments = pattern.split('/').filter(Boolean)
    this.routes.push({ method, pattern, segments, handler })
    return this
  }

  get(pattern, handler) { return this.add('GET', pattern, handler) }
  post(pattern, handler) { return this.add('POST', pattern, handler) }
  patch(pattern, handler) { return this.add('PATCH', pattern, handler) }
  put(pattern, handler) { return this.add('PUT', pattern, handler) }
  delete(pattern, handler) { return this.add('DELETE', pattern, handler) }

  // Returns { handler, params, pattern } or null when nothing matches.
  match(method, pathname) {
    const parts = pathname.split('/').filter(Boolean)
    for (const route of this.routes) {
      if (route.method !== method) continue
      if (route.segments.length !== parts.length) continue
      const params = {}
      let matched = true
      for (let i = 0; i < route.segments.length; i += 1) {
        const segment = route.segments[i]
        if (segment.startsWith(':')) {
          params[segment.slice(1)] = decodeURIComponent(parts[i])
        } else if (segment !== parts[i]) {
          matched = false
          break
        }
      }
      if (matched) return { handler: route.handler, params, pattern: route.pattern }
    }
    return null
  }

  // True when at least one route exists for the path under any other method —
  // lets the gateway answer 405 instead of 404.
  hasPath(pathname) {
    const parts = pathname.split('/').filter(Boolean)
    return this.routes.some((route) => {
      if (route.segments.length !== parts.length) return false
      return route.segments.every((segment, i) => segment.startsWith(':') || segment === parts[i])
    })
  }
}
