"use client"

import { useCallback, useEffect, useState } from "react"
import { Printer } from "lucide-react"
import QRCode from "qrcode"
import { LanguageToggle } from "@/components/LanguageToggle"
import { supabase } from "@/lib/supabaseClient"
import { useAsamblea } from "@/hooks/useAsamblea"
import { useI18n } from "@/lib/i18n"
import { crearHtmlCredenciales } from "@/lib/credencialesImpresion"

type Asambleista = {
  id: string
  nombre: string
  credencial: string
  email: string | null
  telefono: string | null
  metodo_voto: "electronico" | "manual"
  credencial_email_enviado_en: string | null
  credencial_email_error: string | null
  credencial_sms_enviado_en: string | null
  credencial_sms_error: string | null
  dispositivo_autorizado_id: string | null
  dispositivo_alerta_en: string | null
  dispositivo_alerta_detalle: string | null
  iglesia: string | null
  distrito: string | null
  registrado: boolean
  pago_confirmado: boolean
  habilitado: boolean
  presente: boolean
}

export default function OficinaRegionalPage() {
  const { t } = useI18n()
  const {
    asambleaId,
    anioAsamblea,
    lugarAsamblea,
    organizacionNombreSesion,
  } = useAsamblea()

  const [asambleistas, setAsambleistas] = useState<Asambleista[]>([])
  const [cargando, setCargando] = useState(false)

  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevoEmail, setNuevoEmail] = useState("")
  const [nuevoTelefono, setNuevoTelefono] = useState("")
  const [nuevoMetodoVoto, setNuevoMetodoVoto] = useState<"electronico" | "manual">("electronico")
  const [nuevaIglesia, setNuevaIglesia] = useState("")
  const [nuevoDistrito, setNuevoDistrito] = useState("")
  const [csvArchivo, setCsvArchivo] = useState<File | null>(null)
  const [csvProcesando, setCsvProcesando] = useState(false)

  const imprimirCredenciales = async (credenciales: Asambleista[]) => {
    if (credenciales.length === 0) return

    const ventana = window.open("", "_blank")
    if (!ventana) {
      alert(t("Permite ventanas emergentes para imprimir", "Allow pop-ups to print"))
      return
    }

    ventana.opener = null

    try {
      const credencialesConQr = await Promise.all(credenciales.map(async (persona) => ({
        ...persona,
        qrDataUrl: await QRCode.toDataURL(`VOTOAPP:${persona.credencial}`, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 260,
        }),
      })))
      const html = crearHtmlCredenciales({
        organizacion: organizacionNombreSesion,
        evento: [t("Asamblea", "Assembly"), anioAsamblea, lugarAsamblea]
          .filter(Boolean)
          .join(" · "),
        credenciales: credencialesConQr,
        etiquetas: {
          nombre: t("Nombre", "Name"),
          iglesia: t("Iglesia", "Church"),
          distrito: t("Distrito", "District"),
          credencial: t("Credencial", "Credential"),
          imprimir: t("Imprimir credenciales", "Print credentials"),
        },
      })
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }))

      ventana.location.replace(url)
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      ventana.close()
      alert(t("No se pudieron preparar las credenciales", "Could not prepare credentials"))
    }
  }

  const cargarAsambleistas = useCallback(async () => {
    if (!asambleaId) {
      setAsambleistas([])
      return
    }

    const res = await fetch(`/api/oficina/asambleistas?asambleaId=${encodeURIComponent(asambleaId)}`)
    const data = await res.json()

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo cargar la lista de asambleístas", "Could not load assembly members"))
      return
    }

    setAsambleistas(data.asambleistas || [])
  }, [asambleaId, t])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarAsambleistas()
    })

    const canalAsambleistas = supabase
      .channel("realtime-asambleistas-oficina")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "asambleistas",
        },
        () => {
          cargarAsambleistas()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalAsambleistas)
    }
  }, [cargarAsambleistas])

  const actualizarAsambleista = async (
    id: string,
    cambios: Partial<Asambleista>
  ) => {
    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, cambios }),
    })

    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo actualizar el asambleísta", "Could not update assembly member"))
      return
    }

    if (data.asambleista) {
      setAsambleistas((actuales) =>
        actuales.map((asambleista) =>
          asambleista.id === id ? { ...asambleista, ...data.asambleista } : asambleista
        )
      )
    }

    await cargarAsambleistas()
  }

  const describirEnvioCredencial = (data: {
    credencialEmail?: { enviado?: boolean; error?: string }
    credencialSms?: { enviado?: boolean; error?: string }
  }) => {
    const avisosEnvio: string[] = []

    const erroresEmail: Record<string, string> = {
      FALTA_RESEND_API_KEY: "falta configurar RESEND_API_KEY",
      RESEND_TEMPORAL_500: "Resend tuvo un error temporal 500; intenta reenviar más tarde",
      RESEND_TEMPORAL_502: "Resend tuvo un error temporal 502; intenta reenviar más tarde",
      RESEND_TEMPORAL_503: "Resend tuvo un error temporal 503; intenta reenviar más tarde",
      RESEND_TEMPORAL_504: "Resend tuvo un error temporal 504; intenta reenviar más tarde",
      RESEND_TEMPORAL_520: "Resend respondió con error temporal 520; intenta reenviar más tarde",
    }
    const erroresSms: Record<string, string> = {
      FALTA_SENT_CONFIG: "falta configurar SENT_API_KEY, SENT_SENDER_ID y SENT_TEMPLATE_ID",
      SENT_TEMPORAL_500: "Sent tuvo un error temporal 500; intenta reenviar más tarde",
      SENT_TEMPORAL_502: "Sent tuvo un error temporal 502; intenta reenviar más tarde",
      SENT_TEMPORAL_503: "Sent tuvo un error temporal 503; intenta reenviar más tarde",
      SENT_TEMPORAL_504: "Sent tuvo un error temporal 504; intenta reenviar más tarde",
    }

    if (data.credencialEmail && (data.credencialEmail.enviado || data.credencialEmail.error)) {
      const errorEmail =
        data.credencialEmail.error && erroresEmail[data.credencialEmail.error]
          ? erroresEmail[data.credencialEmail.error]
          : data.credencialEmail.error || "revisa la configuración de Resend"

      avisosEnvio.push(
        data.credencialEmail.enviado
          ? "Email enviado"
          : `No se pudo enviar el email: ${errorEmail}`
      )
    }

    if (data.credencialSms && (data.credencialSms.enviado || data.credencialSms.error)) {
      const errorSms =
        data.credencialSms.error && erroresSms[data.credencialSms.error]
          ? erroresSms[data.credencialSms.error]
          : data.credencialSms.error || "revisa la configuración de Sent"

      avisosEnvio.push(
        data.credencialSms.enviado
          ? "SMS enviado"
          : `No se pudo enviar el SMS: ${errorSms}`
      )
    }

    return avisosEnvio
  }

  const activarCredencial = async (id: string, nombre: string, estaHabilitado = false) => {
    if (
      !window.confirm(
        estaHabilitado
          ? t(
              `¿Reenviar la credencial de ${nombre}?`,
              `Resend ${nombre}'s credential?`
            )
          : t(
              `¿Activar y enviar la credencial de ${nombre}?`,
              `Activate and send ${nombre}'s credential?`
            )
      )
    ) {
      return
    }

    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, accion: "activar_credencial" }),
    })

    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo activar la credencial", "Could not activate credential"))
      return
    }

    await cargarAsambleistas()
    alert(
      [
        t(
          "Registro, pago y habilitación completados",
          "Registration, payment, and approval completed"
        ),
        ...describirEnvioCredencial(data),
      ].join("\n")
    )
  }

  const parsearLineaCsv = (linea: string) => {
    const columnas: string[] = []
    let actual = ""
    let dentroComillas = false

    for (let i = 0; i < linea.length; i += 1) {
      const caracter = linea[i]
      const siguiente = linea[i + 1]

      if (caracter === '"' && dentroComillas && siguiente === '"') {
        actual += '"'
        i += 1
      } else if (caracter === '"') {
        dentroComillas = !dentroComillas
      } else if (caracter === "," && !dentroComillas) {
        columnas.push(actual.trim())
        actual = ""
      } else {
        actual += caracter
      }
    }

    columnas.push(actual.trim())
    return columnas
  }

  const importarCsv = async () => {
    if (!asambleaId) {
      alert(t("Primero debes abrir una asamblea", "You must open an assembly first"))
      return
    }

    if (!csvArchivo) {
      alert(t("Selecciona un archivo CSV", "Select a CSV file"))
      return
    }

    setCsvProcesando(true)
    const contenido = await csvArchivo.text()
    const lineas = contenido
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter(Boolean)

    const encabezados = parsearLineaCsv(lineas[0] || "").map((columna) =>
      columna.trim().toLowerCase()
    )
    const requeridos = ["nombre", "email", "telefono", "iglesia", "distrito", "metodo_voto"]
    const faltantes = requeridos.filter((campo) => !encabezados.includes(campo))

    if (faltantes.length > 0) {
      setCsvProcesando(false)
      alert(`El CSV debe incluir estas columnas: ${requeridos.join(", ")}`)
      return
    }

    const filas = lineas.slice(1).map((linea, indice) => {
      const valores = parsearLineaCsv(linea)
      const fila = Object.fromEntries(
        encabezados.map((campo, posicion) => [campo, valores[posicion] || ""])
      )

      return {
        fila: indice + 2,
        nombre: fila.nombre,
        email: fila.email,
        telefono: fila.telefono,
        metodoVoto: fila.metodo_voto === "manual" ? "manual" : "electronico",
        iglesia: fila.iglesia,
        distrito: fila.distrito,
      }
    })
    const res = await fetch("/api/oficina/asambleistas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asambleaId, filas }),
    })
    const data = await res.json().catch(() => null)
    const errores: string[] = Array.isArray(data?.errores) ? data.errores : []

    if (!res.ok || !data?.ok) {
      setCsvProcesando(false)
      alert(data?.error || t("No se pudo subir el pre-registro", "Could not upload pre-registration"))
      return
    }

    setCsvProcesando(false)
    setCsvArchivo(null)
    await cargarAsambleistas()

    alert(
      [
        `Pre-registros creados: ${data.creados || 0}`,
        errores.length ? `Errores:\n${errores.slice(0, 8).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
  }

  const resetearDispositivo = async (id: string, nombre: string) => {
    if (
      !window.confirm(
        t(
          `¿Validar nuevamente el dispositivo de ${nombre}? La persona deberá entrar nuevamente desde su teléfono.`,
          `Validate ${nombre}'s device again? The person will need to enter again from their phone.`
        )
      )
    ) {
      return
    }

    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, accion: "reset_dispositivo" }),
    })

    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo validar nuevamente el dispositivo", "Could not validate the device again"))
      return
    }

    alert(t("Dispositivo reiniciado. El asambleísta puede intentar entrar nuevamente.", "Device released. The assembly member can try entering again."))
    await cargarAsambleistas()
  }

  const resolverDispositivo = async (
    id: string,
    nombre: string,
    accion: "mantener_dispositivo_actual" | "autorizar_dispositivo_intento"
  ) => {
    const mensaje =
      accion === "autorizar_dispositivo_intento"
        ? t(
            `¿Autorizar el nuevo dispositivo de ${nombre}? El dispositivo anterior quedará bloqueado.`,
            `Authorize ${nombre}'s new device? The previous device will be blocked.`
          )
        : t(
            `¿Mantener el dispositivo anterior de ${nombre}? El dispositivo nuevo quedará bloqueado.`,
            `Keep ${nombre}'s previous device? The new device will be blocked.`
          )

    if (!window.confirm(mensaje)) {
      return
    }

    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, accion }),
    })

    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo resolver la validación del dispositivo", "Could not resolve device validation"))
      return
    }

    alert(
      accion === "autorizar_dispositivo_intento"
        ? t("Nuevo dispositivo autorizado. El asambleísta puede entrar nuevamente.", "New device authorized. The assembly member can enter again.")
        : t("Se mantuvo el dispositivo anterior. El asambleísta puede continuar desde ese dispositivo.", "Previous device kept. The assembly member can continue from that device.")
    )
    await cargarAsambleistas()
  }

  const crearAsambleista = async () => {
    if (!nuevoNombre.trim()) {
      alert(t("Nombre es requerido", "Name is required"))
      return
    }

    if (!asambleaId) {
      alert(t("Primero debes abrir una asamblea", "You must open an assembly first"))
      return
    }

    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asambleaId,
        nombre: nuevoNombre,
        email: nuevoEmail,
        telefono: nuevoTelefono,
        metodoVoto: nuevoMetodoVoto,
        iglesia: nuevaIglesia,
        distrito: nuevoDistrito,
      }),
    })

    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo crear el asambleísta", "Could not create assembly member"))
      return
    }

    setNuevoNombre("")
    setNuevoEmail("")
    setNuevoTelefono("")
    setNuevoMetodoVoto("electronico")
    setNuevaIglesia("")
    setNuevoDistrito("")

    await cargarAsambleistas()

    const avisosEnvio: string[] = []

    if (nuevoEmail.trim()) {
      const erroresEmail: Record<string, string> = {
        FALTA_RESEND_API_KEY: "falta configurar RESEND_API_KEY",
        RESEND_TEMPORAL_500: "Resend tuvo un error temporal 500; intenta reenviar más tarde",
        RESEND_TEMPORAL_502: "Resend tuvo un error temporal 502; intenta reenviar más tarde",
        RESEND_TEMPORAL_503: "Resend tuvo un error temporal 503; intenta reenviar más tarde",
        RESEND_TEMPORAL_504: "Resend tuvo un error temporal 504; intenta reenviar más tarde",
        RESEND_TEMPORAL_520: "Resend respondió con error temporal 520; intenta reenviar más tarde",
      }
      const errorEmail =
        data.credencialEmail?.error &&
        erroresEmail[data.credencialEmail.error]
          ? erroresEmail[data.credencialEmail.error]
          : data.credencialEmail?.error || "revisa la configuración de Resend"

      avisosEnvio.push(
        data.credencialEmail?.enviado
          ? "Email enviado"
          : `No se pudo enviar el email: ${errorEmail}`
      )
    }

    if (nuevoTelefono.trim()) {
      const erroresSms: Record<string, string> = {
        FALTA_SENT_CONFIG: "falta configurar SENT_API_KEY, SENT_SENDER_ID y SENT_TEMPLATE_ID",
        SENT_TEMPORAL_500: "Sent tuvo un error temporal 500; intenta reenviar más tarde",
        SENT_TEMPORAL_502: "Sent tuvo un error temporal 502; intenta reenviar más tarde",
        SENT_TEMPORAL_503: "Sent tuvo un error temporal 503; intenta reenviar más tarde",
        SENT_TEMPORAL_504: "Sent tuvo un error temporal 504; intenta reenviar más tarde",
      }
      const errorSms =
        data.credencialSms?.error &&
        erroresSms[data.credencialSms.error]
          ? erroresSms[data.credencialSms.error]
          : data.credencialSms?.error || "revisa la configuración de Sent"

      avisosEnvio.push(
        data.credencialSms?.enviado
          ? "SMS enviado"
          : `No se pudo enviar el SMS: ${errorSms}`
      )
    }

    alert(
      [
        `Asambleísta creado y activado: ${data.asambleista.credencial}`,
        ...avisosEnvio,
      ].join("\n")
    )
  }

  return (
    <main className="min-h-screen bg-[#f4f6f1] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6f5b1d]">
            {organizacionNombreSesion}
          </p>
          <div className="mt-2 flex items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-slate-950">
                {t("Registro de asambleístas", "Assembly member registration")}
              </h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                {t(
                  "Confirmación de registro, pago y habilitación antes del acceso a votación.",
                  "Registration, payment, and approval before voting access."
                )}
              </p>
            </div>
            <LanguageToggle />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {t("Total", "Total")}
                </p>
                <p className="text-2xl font-black">{asambleistas.length}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  {t("Habilitados", "Approved")}
                </p>
                <p className="text-2xl font-black text-emerald-800">
                  {asambleistas.filter((a) => a.habilitado).length}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  {t("Pendientes", "Pending")}
                </p>
                <p className="text-2xl font-black text-amber-800">
                  {asambleistas.filter((a) => !a.habilitado).length}
                </p>
              </div>
            </div>
          </div>
        </header>

        {!asambleaId && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 shadow-sm">
            {t(
              "No hay una asamblea activa. Crea o inicia una asamblea antes de registrar participantes.",
              "There is no active assembly. Create or start an assembly before registering participants."
            )}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">{t("Nuevo asambleísta", "New assembly member")}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-6">

          <input
            type="text"
            placeholder={t("Nombre y apellido", "Full name")}
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          />

          <input
            type="email"
            placeholder="Email"
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          />

          <input
            type="tel"
            placeholder={t("Celular", "Mobile phone")}
            value={nuevoTelefono}
            onChange={(e) => setNuevoTelefono(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          />

          <select
            value={nuevoMetodoVoto}
            onChange={(e) => setNuevoMetodoVoto(e.target.value as "electronico" | "manual")}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          >
            <option value="electronico">{t("Voto electrónico", "Electronic vote")}</option>
            <option value="manual">{t("Voto manual", "Manual vote")}</option>
          </select>

          <input
            type="text"
            placeholder={t("Iglesia", "Church")}
            value={nuevaIglesia}
            onChange={(e) => setNuevaIglesia(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          />

          <input
            type="text"
            placeholder={t("Distrito", "District")}
            value={nuevoDistrito}
            onChange={(e) => setNuevoDistrito(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          />
          </div>

          <button
            onClick={crearAsambleista}
            disabled={cargando || !asambleaId}
            className="mt-4 rounded-lg bg-[#16382f] px-4 py-2.5 font-bold text-white transition hover:bg-[#0f2b24] disabled:opacity-40"
          >
            {t("Crear y activar asambleísta", "Create and activate assembly member")}
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                {t("Pre-registro por CSV", "CSV pre-registration")}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                {t(
                  "Carga asambleístas antes del evento sin enviar credenciales. Luego usa Activar credencial para enviar email y SMS.",
                  "Load assembly members before the event without sending credentials. Then use Activate credential to send email and SMS."
                )}
              </p>
              <div className="mt-3 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
                nombre,email,telefono,iglesia,distrito,metodo_voto
                <br />
                Angel Ruiz,angel@email.com,+16168480206,ICP,Indiana,electronico
              </div>
            </div>

            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setCsvArchivo(event.target.files?.[0] || null)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
              />
              <button
                type="button"
                onClick={importarCsv}
                disabled={csvProcesando || cargando || !csvArchivo || !asambleaId}
                className="mt-3 w-full rounded-lg bg-[#16382f] px-4 py-2.5 font-bold text-white transition hover:bg-[#0f2b24] disabled:opacity-40"
              >
                {csvProcesando
                  ? t("Importando...", "Importing...")
                  : t("Subir pre-registro", "Upload pre-registration")}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black text-slate-950">{t("Lista de asambleístas", "Assembly member list")}</h2>
            <button
              type="button"
              onClick={() => imprimirCredenciales(asambleistas)}
              disabled={asambleistas.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#16382f] px-4 text-sm font-bold text-white transition hover:bg-[#0f2b24] disabled:opacity-40"
            >
              <Printer className="h-4 w-4" />
              {t("Imprimir todas", "Print all")}
            </button>
          </div>

          {asambleistas.length === 0 && (
            <p className="p-5 text-slate-500">{t("No hay registros", "No records")}</p>
          )}

          <div>
            {asambleistas.map((a) => (
              <div
                key={a.id}
                className={[
                  "border-b border-slate-100 p-5 last:border-b-0",
                  a.dispositivo_alerta_en ? "bg-red-50/35" : "bg-white",
                ].join(" ")}
              >
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-xl font-black text-slate-950">{a.nombre}</p>
                        <p className="mt-1 font-mono text-sm font-bold text-[#6f5b1d]">
                          {a.credencial}
                        </p>
                      </div>
                      <span
                        className={[
                          "w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide",
                          a.metodo_voto === "manual"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-[#e9f3ef] text-[#16382f]",
                        ].join(" ")}
                      >
                        {a.metodo_voto === "manual" ? t("Voto manual", "Manual vote") : t("Voto electrónico", "Electronic vote")}
                      </span>
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Email</p>
                        <p className="mt-1 truncate font-semibold text-slate-700">{a.email || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("Celular", "Mobile")}</p>
                        <p className="mt-1 font-semibold text-slate-700">{a.telefono || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("Iglesia / Distrito", "Church / District")}</p>
                        <p className="mt-1 truncate font-semibold text-slate-700">
                          {a.iglesia || "N/A"} · {a.distrito || "N/A"}
                        </p>
                      </div>
                    </div>

                    {a.dispositivo_alerta_en && (
                      <div
                        title={a.dispositivo_alerta_detalle || ""}
                        className="rounded-xl border border-red-200 bg-white p-3 text-sm font-bold text-red-700 shadow-sm"
                      >
                        {t(
                          "Requiere validación de dispositivo. Verifica la identidad y escoge cuál dispositivo quedará activo.",
                          "Device validation required. Verify identity and choose which device will remain active."
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className={a.registrado ? "rounded-full bg-blue-50 px-2.5 py-1 text-blue-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-slate-500"}>
                        {a.registrado ? t("Registrado", "Registered") : t("Sin registrar", "Not registered")}
                      </span>
                      <span className={a.pago_confirmado ? "rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-slate-500"}>
                        {a.pago_confirmado ? t("Pago confirmado", "Payment confirmed") : t("Pago pendiente", "Payment pending")}
                      </span>
                      <span className={a.habilitado ? "rounded-full bg-[#e9f3ef] px-2.5 py-1 text-[#16382f]" : "rounded-full bg-amber-50 px-2.5 py-1 text-amber-700"}>
                        {a.habilitado ? t("Habilitado", "Approved") : t("No habilitado", "Not approved")}
                      </span>
                      <span className={a.presente ? "rounded-full bg-green-50 px-2.5 py-1 text-green-700" : "rounded-full bg-red-50 px-2.5 py-1 text-red-700"}>
                        {a.presente ? t("Presente", "Present") : t("Fuera", "Out")}
                      </span>
                      {a.email && (
                        <span
                          className={
                            a.credencial_email_enviado_en
                              ? "rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"
                              : "rounded-full bg-red-50 px-2.5 py-1 text-red-700"
                          }
                        >
                          {a.credencial_email_enviado_en
                            ? t("Email enviado", "Email sent")
                            : t("Email no enviado", "Email not sent")}
                        </span>
                      )}
                      {a.telefono && (
                        <span
                          className={
                            a.credencial_sms_enviado_en
                              ? "rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"
                              : "rounded-full bg-red-50 px-2.5 py-1 text-red-700"
                          }
                        >
                          {a.credencial_sms_enviado_en
                            ? t("SMS enviado", "SMS sent")
                            : t("SMS no enviado", "SMS not sent")}
                        </span>
                      )}
                      {a.dispositivo_autorizado_id && (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
                          {t("Dispositivo autorizado", "Authorized device")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      {t("Acciones", "Actions")}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <select
                      value={a.metodo_voto || "electronico"}
                      disabled={cargando}
                      onChange={(e) =>
                        actualizarAsambleista(a.id, {
                          metodo_voto: e.target.value as Asambleista["metodo_voto"],
                        })
                      }
                      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-40"
                    >
                      <option value="electronico">{t("Electrónico", "Electronic")}</option>
                      <option value="manual">{t("Manual", "Manual")}</option>
                    </select>

                    <button
                      disabled={cargando}
                      onClick={() => activarCredencial(a.id, a.nombre, a.habilitado)}
                      className="h-10 rounded-lg bg-[#8a6f1f] px-3 text-sm font-bold text-white disabled:opacity-40"
                    >
                      {a.habilitado
                        ? t("Reenviar credencial", "Resend credential")
                        : t("Activar credencial", "Activate credential")}
                    </button>

                    <button
                      type="button"
                      onClick={() => imprimirCredenciales([a])}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Printer className="h-4 w-4" />
                      {t("Imprimir credencial", "Print credential")}
                    </button>

                    {a.dispositivo_alerta_en ? (
                      <>
                        <button
                          disabled={cargando}
                          onClick={() =>
                            resolverDispositivo(a.id, a.nombre, "mantener_dispositivo_actual")
                          }
                          className="h-10 rounded-lg bg-slate-700 px-3 text-sm font-bold text-white disabled:opacity-40"
                        >
                          {t("Mantener anterior", "Keep previous")}
                        </button>
                        <button
                          disabled={cargando}
                          onClick={() =>
                            resolverDispositivo(a.id, a.nombre, "autorizar_dispositivo_intento")
                          }
                          className="h-10 rounded-lg bg-amber-600 px-3 text-sm font-bold text-white disabled:opacity-40"
                        >
                          {t("Autorizar nuevo", "Authorize new")}
                        </button>
                      </>
                    ) : a.dispositivo_autorizado_id ? (
                      <button
                        disabled={cargando}
                        onClick={() => resetearDispositivo(a.id, a.nombre)}
                        className="h-10 rounded-lg bg-amber-600 px-3 text-sm font-bold text-white disabled:opacity-40"
                      >
                        {t("Liberar dispositivo", "Release device")}
                      </button>
                    ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
