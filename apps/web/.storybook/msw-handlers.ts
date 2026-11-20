import { http, HttpResponse } from 'msw'

export const mswHandlers = [
  http.get('/__storybook__/health', () => HttpResponse.json({ ok: true })),
]
