import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 100,
  duration: '2m',
}

export default function () {
  const payload = JSON.stringify({
    sessionId: `load-test-${__VU}`,
    message: 'hello',
  })

  const response = http.post('http://localhost:3000/api/chat', payload, {
    headers: { 'Content-Type': 'application/json' },
  })

  check(response, {
    'status is 200': (r) => r.status === 200,
  })

  sleep(1)
}
