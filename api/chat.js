export default async function handler(req) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 500 }
    )
  }

  const { systemContext, messages } = await req.json()
  if (!messages?.length) {
    return Response.json({ error: 'messages array is required' }, { status: 400 })
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     systemContext ?? '',
      messages,
    }),
  })

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}))
    return Response.json(
      { error: err?.error?.message ?? `Anthropic error ${upstream.status}` },
      { status: upstream.status }
    )
  }

  const data = await upstream.json()
  return Response.json({ text: data.content?.[0]?.text ?? 'No response.' })
}
