/* eslint-disable no-console, no-constant-condition */
// comparing to a tcp like
import { create, setOutput, getCurrent, setWndSize,
  setNodelay, update, input, recv, send } from '../index'
import { NetworkSimulator } from './network_simulator'

// NOTE: the gc may affect the results
function test(mode) {
  const network = new NetworkSimulator(10, 60, 125)

  const output = (buf, kcp, user) => network.send(user, buf)

  const kcp1 = create(1, 0)
  const kcp2 = create(1, 1)
  setOutput(kcp1, output)
  setOutput(kcp2, output)

  let current = getCurrent()
  let slap = current + 20
  let index = 0
  let next = 0
  let sumrtt = 0
  let count = 0
  let maxrtt = 0

  setWndSize(kcp1, 128, 128)
  setWndSize(kcp2, 128, 128)

  // 判断测试用例的模式
  if (mode === 0) {
    // 默认模式
    setNodelay(kcp1, 0, 10, 0, 0)
    setNodelay(kcp2, 0, 10, 0, 0)
  } else if (mode === 1) {
    // 普通模式，关闭流控等
    setNodelay(kcp1, 0, 10, 0, 1)
    setNodelay(kcp2, 0, 10, 0, 1)
  } else {
    // 启动快速模式
    // 第二个参数 nodelay-启用以后若干常规加速将启动
    // 第三个参数 interval为内部处理时钟，默认设置为 10ms
    // 第四个参数 resend为快速重传指标，设置为2
    // 第五个参数 为是否禁用常规流控，这里禁止
    setNodelay(kcp1, 1, 10, 2, 1)
    setNodelay(kcp2, 1, 10, 2, 1)
    kcp1.rx_minrto = 10
    kcp1.fastresend = 1
  }

  const buffer = Buffer.allocUnsafe(2000)
  let ts1 = getCurrent()

  const printResult = () => {
    ts1 = getCurrent() - ts1

    const names = ['default', 'normal', 'fast']

    console.log(`${names[mode]} mode result (${ts1}ms):`)
    console.log(`avgrtt=${sumrtt / count} maxrtt=${maxrtt} tx=${network.tx1}`)
  }

  const run = () => {
    current = getCurrent()

    update(kcp1, current)
    update(kcp2, current)

    for (; current >= slap; slap += 20) {
      // eslint-disable-next-line
      buffer.writeUInt32BE(index++)
      buffer.writeUInt32BE(current, 4)

      // console.log('write buf', buffer.slice(0, 8))

      send(kcp1, buffer.slice(0, 8))
    }

    while (true) {
      const res = network.recv(1)
      if (res < 0) {
        break
      }
      input(kcp2, res)
    }

    while (true) {
      const res = network.recv(0)
      if (res < 0) {
        break
      }
      input(kcp1, res)
    }

    while (true) {
      const res = recv(kcp2)
      if (res < 0) {
        break
      }
      send(kcp2, res)
    }

    while (true) {
      const res = recv(kcp1)

      if (res < 0) {
        break
      }

      const sn = res.readUInt32BE(0)
      const ts = res.readUInt32BE(4)
      const rtt = current - ts

      // TODO: sn is different from
      // console.log('res', res)
      // console.log('sn', sn, next, count)

      if (sn !== next) {
        console.log(`ERROR sn ${sn}<->${next}\n`)
        return
      }

      next += 1
      sumrtt += rtt
      count += 1

      if (rtt > maxrtt) {
        maxrtt = rtt
      }

      console.log(`[RECV] mode=${mode} sn=${sn} rtt=${rtt}`)
    }

    if (next <= 1000) {
      process.nextTick(run)
    } else {
      printResult()
    }
  }

  process.nextTick(run)
}

function main() {
  test(0)
}

main()
