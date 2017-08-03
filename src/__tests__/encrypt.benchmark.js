import { encrypt, decrypt } from '../encrypt'

const TIMES = 100000
const MTU = 1500

const algorithm = 'aes-128-cbc'
const password = 'test'
const buf = Buffer.alloc(MTU)
const t1 = Date.now()

// 34471
for (let i = 0; i < TIMES; i += 1) {
  const encrypted = encrypt(algorithm, password, buf)
  decrypt(algorithm, password, encrypted)
}

const time = Date.now() - t1

// encrypt and decrypt a 1500 bytes buffer 100000 times:
//   total: 4751ms, 21.048200378867605 ops/ms, 47.51 ns/op
// eslint-disable-next-line
console.log(`encrypt and decrypt a ${MTU} bytes buffer ${TIMES} times:
  total: ${time}ms, ${TIMES / time} ops/ms, ${time / TIMES * 1000} ns/op`)
