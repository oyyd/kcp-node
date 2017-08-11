/**
 * One socket.
 */
import net from 'net'
import { KCPSocket } from '../socket'
import { Server } from '../server'
import { createPool } from '../pool'

const localPort = 23456

const DATA_SIZE = 4 * 1024 * 1024
const TIMES = 1

const testKCPSocket = () => new Promise((resolve) => {
  const pool = createPool()
  const server = new Server({
    pool,
    localPort,
  })

  const socket = new KCPSocket(null, {
    pool,
    remoteAddr: '127.0.0.1',
    remotePort: localPort,
  })

  let connection = null

  server.on('connection', (conn) => {
    connection = conn
    conn.on('error', err => console.error('conn', err))
    conn.on('data', (msg) => {
      // console.log('conn', msg)
      if (msg) {
        conn.write(msg)
      }
    })
  })

  // bytes
  let received = 0
  let count = 0
  let date

  socket.on('data', (msg) => {
    // console.log('msg', msg)
    if (msg) {
      received += msg.length
      if (received >= DATA_SIZE) {
        received -= DATA_SIZE
        count += 1

        if (count === TIMES) {
          socket.close()
          server.close()
          console.log(`kcp socket: ${Date.now() - date}`)
          resolve()
        }
      }
    }
  })

  socket.on('error', err => console.error(err))

  date = Date.now()

  for (let i = 0; i < TIMES; i += 1) {
    socket.write(Buffer.alloc(DATA_SIZE, '00', 'hex'))
  }
})

const testTCP = () => new Promise((resolve) => {
  const server = net.createServer((conn) => {
    conn.on('data', (d) => {
      // console.log('d', d)

      conn.write(d)
    })
  })

  server.listen(localPort)

  let start

  const socket = net.createConnection({
    port: localPort,
    host: '127.0.0.1',
  }, () => {
    start = Date.now()
    for (let i = 0; i < TIMES; i += 1) {
      socket.write(Buffer.allocUnsafe(DATA_SIZE))
    }
  })

  let received = 0

  socket.on('data', (d) => {
    received += d.length
    if (received === DATA_SIZE * TIMES) {
      console.log(`tcp socket: ${Date.now() - start}`)
      socket.end()
      server.close()
      resolve()
    }
  })
})

testTCP()

// testKCPSocket().catch(err => {
//   throw err
// })
