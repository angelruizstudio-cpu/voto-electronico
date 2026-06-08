export async function getSentMessageStatus(messageId: string) {
  const apiKey = process.env.SENT_API_KEY

  if (!apiKey) {
    throw new Error("Missing required environment variable SENT_API_KEY")
  }

  const [statusRes, activitiesRes] = await Promise.all([
    fetch(`https://api.sent.dm/v3/messages/${messageId}`, {
      headers: { "x-api-key": apiKey },
    }),
    fetch(`https://api.sent.dm/v3/messages/${messageId}/activities`, {
      headers: { "x-api-key": apiKey },
    }),
  ])

  const [statusText, activitiesText] = await Promise.all([
    statusRes.text(),
    activitiesRes.text(),
  ])

  const parseJson = (text: string) => {
    try {
      return text ? JSON.parse(text) : null
    } catch {
      return { raw: text }
    }
  }

  const statusData = parseJson(statusText)
  const activitiesData = parseJson(activitiesText)

  return {
    status: statusData?.data?.status,
    statusResponse: {
      httpStatus: statusRes.status,
      body: statusData,
    },
    activities: activitiesData?.data?.activities ?? [],
    activitiesResponse: {
      httpStatus: activitiesRes.status,
      body: activitiesData,
    },
  }
}
