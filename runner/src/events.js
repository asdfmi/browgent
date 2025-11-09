const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || 'http://localhost:3000';
const SECRET = process.env.INTERNAL_SECRET || '';

export async function postEvent(runId, payload) {
  const url = `${PORTAL_BASE_URL}/internal/runs/${encodeURIComponent(runId)}/events`;
  const body = {
    ...payload,
    ts: payload?.ts ?? Date.now(),
  };
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SECRET}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn('Failed to post runner event', error);
  }
}
