import dgram from 'dgram'

function main() {
  const s1 = dgram.createSocket('udp4')
  const s12 = dgram.createSocket('udp4')
  const s2 = dgram.createSocket('udp4')
  const TIMES = 4 * 1024

  let port = null
  let times = 0
  let received = 0
  let start = 0

  s2.on('message', (msg) => {
    times += 1
    received += msg.length
    console.log(`received: ${times} ${received}`)

    if (times === TIMES) {
      console.log(`${Date.now() - start} elapses`)
    }
  })

  function sendMsg(socket) {
    for (let i = 0; i < TIMES; i += 1) {
      socket.send(Buffer.allocUnsafe(1400), port)
    }
  }

  s2.bind(() => {
    port = s2.address().port
    start = Date.now()

    sendMsg(s1)
  })
}

main()
