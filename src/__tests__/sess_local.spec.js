const { update, createSession } = require('../sess')

describe('sess_local', () => {
  it('should send data from one side the other side through sessions', (done) => {
    const a = createSession(1)
    const b = createSession(1)
    const data = Buffer.from('ffff0000', 'hex')

    a.bind(() => {
      a.on('message', (d) => {
        expect(d.toString('hex')).toBe('ffff0000')
        done()
      })

      const { port } = a.address()

      b.send(data, port)

      setInterval(() => {
        update(b)
        update(a)
      }, 20)
    })
  })
})
