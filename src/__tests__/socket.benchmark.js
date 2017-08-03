/**
 * One socket.
 */
import net from 'net'
import { KCPSocket } from '../socket'
import { Server } from '../server'
import { createPool } from '../pool'

const localPort = 23456

const DATA_SIZE = 2048
const TIMES = 100

const testKCPSocket = () => {
  new Promise((resolve) => {
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

    server.on('connection', (conn) => {
      conn.on('data', (msg) => {
        console.log('conn', msg)
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
      console.log('msg', msg)
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

    date = Date.now()

    for (let i = 0; i < TIMES; i += 1) {
      socket.write(Buffer.allocUnsafe(DATA_SIZE))
    }
  })
}

// testKCPSocket().catch(err => {
//   throw err
// })

const testTCP = () => new Promise((resolve) => {
  const server = net.createServer((conn) => {
    conn.on('data', (d) => {
      console.log('d', d)

      conn.write(d)
    })
  })

  server.listen(localPort)

  const socket = net.createConnection({
    port: localPort,
    host: '127.0.0.1',
  }, () => {
    for (let i = 0; i < TIMES; i += 1) {
      socket.write(Buffer.allocUnsafe(DATA_SIZE))
    }
  })

  socket.on('data', (d) => {
    console.log('recv', d.length)
  })
})

testTCP()
