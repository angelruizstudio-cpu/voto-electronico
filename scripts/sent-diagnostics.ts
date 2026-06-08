/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

type JsonObject = Record<string, any>

const SENT_BASE_URL = "https://api.sent.dm/v3"

function loadEnvFile(fileName: string) {
  const filePath = join(process.cwd(), fileName)

  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, "utf8")

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)

    if (!match) {
      continue
    }

    const [, key, rawValue] = match
    const value = rawValue.replace(/^["']|["']$/g, "")

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

const apiKey = process.env.SENT_API_KEY
const senderId = process.env.SENT_SENDER_ID
const configuredTemplateId = process.env.SENT_TEMPLATE_ID
const testPhone = process.env.SENT_TEST_PHONE

if (!apiKey) {
  throw new Error("Missing required environment variable SENT_API_KEY")
}

if (!senderId) {
  throw new Error("Missing required environment variable SENT_SENDER_ID")
}

const requiredApiKey = apiKey
const requiredSenderId = senderId

async function sentRequest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SENT_BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-api-key": requiredApiKey,
      ...(init.headers || {}),
    },
  })
  const body = await res.text()
  let data: JsonObject | null = null

  try {
    data = body ? JSON.parse(body) : null
  } catch {
    data = { raw: body }
  }

  return { res, data, body }
}

function getItems(data: JsonObject | null): JsonObject[] {
  if (Array.isArray(data?.data)) {
    return data.data
  }

  if (Array.isArray(data?.data?.items)) {
    return data.data.items
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (Array.isArray(data?.profiles)) {
    return data.profiles
  }

  if (Array.isArray(data?.templates)) {
    return data.templates
  }

  return []
}

function isSmsEnabled(item: JsonObject) {
  const channels = item.channels || item.enabled_channels || item.available_channels || []
  const channelNames = Array.isArray(channels)
    ? channels.map((channel) => String(channel?.name || channel).toLowerCase())
    : []

  return (
    channelNames.includes("sms") ||
    item.sms_enabled === true ||
    item.sms?.enabled === true ||
    String(item.default_channel || "").toLowerCase() === "sms"
  )
}

function isApprovedTemplate(template: JsonObject) {
  const status = String(template.status || template.state || "").toUpperCase()
  return ["ACTIVE", "APPROVED", "PUBLISHED"].includes(status)
}

function getTemplateVariables(template: JsonObject) {
  return (
    template.variables ||
    template.body_variables ||
    template.parameters ||
    template.template?.variables ||
    []
  )
}

async function main() {
  console.log("Sent.dm diagnostics")
  console.log("-------------------")
  console.log("SENT_SENDER_ID:", `${requiredSenderId.slice(0, 4)}...${requiredSenderId.slice(-4)}`)
  console.log("SENT_TEMPLATE_ID:", configuredTemplateId || "not configured")
  console.log("")

  console.log("1. Verificando profiles/senders...")
  const profilesResult = await sentRequest("/profiles")
  console.log("HTTP status:", profilesResult.res.status)
  const profiles = getItems(profilesResult.data)

  for (const profile of profiles) {
    console.log({
      id: profile.id,
      name: profile.name,
      status: profile.status || profile.state,
      channels: profile.channels || profile.enabled_channels || profile.available_channels,
      smsActive: isSmsEnabled(profile),
    })
  }

  const senderProfile = profiles.find((profile) => String(profile.id) === requiredSenderId)
  const profileSmsActive = senderProfile ? isSmsEnabled(senderProfile) : false

  if (!senderProfile) {
    console.log("No se encontro SENT_SENDER_ID en /profiles.")
  }

  console.log("")
  console.log("2. Verificando templates...")
  const templatesResult = await sentRequest("/templates")
  console.log("HTTP status:", templatesResult.res.status)
  const templates = getItems(templatesResult.data)

  for (const template of templates) {
    console.log({
      id: template.id,
      name: template.name,
      status: template.status || template.state,
      channels: template.channels,
      variables: getTemplateVariables(template),
    })
  }

  let approvedSmsTemplate = templates.find(
    (template) =>
      isApprovedTemplate(template) &&
      isSmsEnabled(template) &&
      String(template.id) === configuredTemplateId
  )

  if (!approvedSmsTemplate) {
    approvedSmsTemplate = templates.find(
      (template) => isApprovedTemplate(template) && isSmsEnabled(template)
    )
  }

  let templateId = approvedSmsTemplate?.id || configuredTemplateId
  let templateCreated = false

  if (!approvedSmsTemplate && !configuredTemplateId) {
    console.log("")
    console.log("3. No se encontro template SMS aprobado. Intentando crear uno nuevo...")

    const createResult = await sentRequest("/templates", {
      method: "POST",
      headers: {
        "x-sender-id": requiredSenderId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category: "UTILITY",
        language: "es",
        definition: {
          header: null,
          body: {
            multiChannel: {
              type: "body",
              template:
                "Saludos {{0:variable}}. Su credencial de asamblea es {{1:variable}} . Msg&Data rates may apply. Reply STOP to unsubscribe or HELP for help.",
              variables: [
                {
                  id: 0,
                  name: "nombre",
                  type: "variable",
                  props: {
                    variableType: "text",
                    sample: "Angel Test",
                    regex: null,
                    url: null,
                    shortUrl: null,
                    alt: null,
                    mediaType: null,
                  },
                },
                {
                  id: 1,
                  name: "credencial",
                  type: "variable",
                  props: {
                    variableType: "text",
                    sample: "AR26-01",
                    regex: null,
                    url: null,
                    shortUrl: null,
                    alt: null,
                    mediaType: null,
                  },
                },
              ],
            },
            sms: null,
            whatsapp: null,
            rcs: null,
          },
          footer: null,
          buttons: null,
          definitionVersion: "1.0",
          authenticationConfig: null,
        },
        creation_source: "from-api",
        submit_for_review: false,
        sandbox: false,
      }),
    })

    console.log("HTTP status:", createResult.res.status)
    console.log(JSON.stringify(createResult.data, null, 2))
    templateId = createResult.data?.data?.id || createResult.data?.id || templateId
    templateCreated = Boolean(templateId)
  } else {
    console.log("")
    if (approvedSmsTemplate) {
      console.log("3. Template SMS aprobado encontrado:", {
        id: approvedSmsTemplate.id,
        name: approvedSmsTemplate.name,
      })
    } else {
      console.log("3. Usando SENT_TEMPLATE_ID configurado:", templateId)
    }
  }

  let messageId: string | undefined
  let finalStatus = "NOT_SENT"
  let finalReason = ""

  console.log("")
  console.log("4. Enviando mensaje sandbox...")

  if (!testPhone) {
    console.log("No se envio prueba porque falta SENT_TEST_PHONE en .env.local.")
  } else if (!templateId) {
    console.log("No se envio prueba porque no hay templateId disponible.")
  } else {
    const messageResult = await sentRequest("/messages", {
      method: "POST",
      headers: {
        "x-sender-id": requiredSenderId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: [testPhone],
        channel: ["sms"],
        template: {
          id: templateId,
          parameters: {
            code: "AR26-01",
            var_2: "Angel Test",
          },
        },
        sandbox: true,
      }),
    })

    console.log("HTTP status:", messageResult.res.status)
    console.log(JSON.stringify(messageResult.data, null, 2))
    messageId =
      messageResult.data?.data?.recipients?.[0]?.message_id ||
      messageResult.data?.data?.recipients?.[0]?.id ||
      messageResult.data?.data?.message_id ||
      messageResult.data?.data?.id

    console.log("message_id:", messageId || "no disponible")
  }

  if (messageId) {
    console.log("")
    console.log("5. Consultando actividades del mensaje...")

    const [statusResult, activitiesResult] = await Promise.all([
      sentRequest(`/messages/${messageId}`),
      sentRequest(`/messages/${messageId}/activities`),
    ])

    console.log("Status response:")
    console.log(JSON.stringify(statusResult.data, null, 2))
    console.log("Activities response:")
    console.log(JSON.stringify(activitiesResult.data, null, 2))

    finalStatus = String(statusResult.data?.data?.status || "UNKNOWN")
    const activities = getItems(activitiesResult.data)
    const failedActivity = activities.find((activity) =>
      String(activity.status || "").toUpperCase().includes("FAILED")
    )

    finalReason =
      failedActivity?.error_message ||
      failedActivity?.error_code ||
      failedActivity?.provider_failure_reason ||
      failedActivity?.description ||
      ""
  }

  console.log("")
  console.log("6. Resumen final")
  console.log({
    profileSmsActive: profileSmsActive ? "✅" : "❌",
    template: {
      id: templateId,
      name: approvedSmsTemplate?.name || null,
      created: templateCreated,
      approved: Boolean(approvedSmsTemplate),
    },
    sandboxMessageId: messageId || null,
    finalStatus,
    finalReason: finalReason || null,
  })
}

main().catch((error) => {
  console.error("Sent.dm diagnostics failed")
  console.error(error)
  process.exit(1)
})
