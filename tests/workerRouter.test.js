import { describe, expect, it } from 'vitest'
import { Router } from '../worker/src/router.js'

const noop = () => new Response('ok')

describe('worker Router', () => {
  it('matches a static route and its method', () => {
    const router = new Router().get('/health', noop)
    expect(router.match('GET', '/health')).toMatchObject({ pattern: '/health', params: {} })
    expect(router.match('POST', '/health')).toBeNull()
  })

  it('captures path parameters', () => {
    const router = new Router().get('/family/:id', noop)
    const matched = router.match('GET', '/family/abc-123')
    expect(matched.params).toEqual({ id: 'abc-123' })
  })

  it('decodes URL-encoded parameters', () => {
    const router = new Router().get('/family/:id', noop)
    expect(router.match('GET', '/family/a%2Fb').params).toEqual({ id: 'a/b' })
  })

  it('does not match paths of a different segment count', () => {
    const router = new Router().get('/family/:id', noop)
    expect(router.match('GET', '/family')).toBeNull()
    expect(router.match('GET', '/family/a/b')).toBeNull()
  })

  it('reports when a path exists under another method (for 405 vs 404)', () => {
    const router = new Router().get('/family/:id', noop).post('/family', noop)
    expect(router.hasPath('/family/xyz')).toBe(true)
    expect(router.hasPath('/family')).toBe(true)
    expect(router.hasPath('/unknown/path')).toBe(false)
  })

  it('respects registration order for overlapping routes', () => {
    const first = () => new Response('first')
    const second = () => new Response('second')
    const router = new Router().get('/a/:x', first).get('/a/b', second)
    // ':x' registered first, so it wins for /a/b.
    expect(router.match('GET', '/a/b').handler).toBe(first)
  })
})
