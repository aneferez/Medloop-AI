// Thin, parameterized helpers over the D1 binding. Every call binds arguments;
// no string interpolation of user input into SQL.
export function createDb(d1) {
  return {
    first(sql, params = []) {
      return d1.prepare(sql).bind(...params).first()
    },
    async all(sql, params = []) {
      const result = await d1.prepare(sql).bind(...params).all()
      return result.results || []
    },
    run(sql, params = []) {
      return d1.prepare(sql).bind(...params).run()
    },
    // Atomic multi-statement write. Each item is { sql, params }.
    batch(statements) {
      return d1.batch(statements.map(({ sql, params = [] }) => d1.prepare(sql).bind(...params)))
    },
    prepare: (sql) => d1.prepare(sql),
  }
}
