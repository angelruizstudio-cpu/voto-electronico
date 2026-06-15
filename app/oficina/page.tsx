"use client"

import { useCallback, useEffect, useState } from "react"
import { LanguageToggle } from "@/components/LanguageToggle"
import { supabase } from "@/lib/supabaseClient"
import { useAsamblea } from "@/hooks/useAsamblea"
import { useI18n } from "@/lib/i18n"

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
    organizacionAsamblea,
    estadoAsamblea,
    nuevoAnio,
    nuevoLugar,
    nuevaOrganizacion,
    setNuevoAnio,
    setNuevoLugar,
    setNuevaOrganizacion,
    crearAsambleaPreparacion,
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
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<
    | "todos"
    | "pendientes"
    | "habilitados"
    | "manuales"
    | "email_fallido"
    | "sms_fallido"
    | "dispositivo"
  >("todos")

  const resumenOperacion = {
    pendientes: asambleistas.filter((a) => !a.habilitado).length,
    emailFallido: asambleistas.filter((a) => a.email && !a.credencial_email_enviado_en).length,
    smsFallido: asambleistas.filter((a) => a.telefono && !a.credencial_sms_enviado_en).length,
    dispositivos: asambleistas.filter((a) => a.dispositivo_alerta_en).length,
    manuales: asambleistas.filter((a) => a.metodo_voto === "manual").length,
  }

  const asambleistasFiltrados = asambleistas.filter((a) => {
    const texto = `${a.nombre} ${a.credencial} ${a.email || ""} ${a.telefono || ""} ${a.iglesia || ""} ${a.distrito || ""}`.toLowerCase()
    const coincideBusqueda = texto.includes(busqueda.trim().toLowerCase())

    if (!coincideBusqueda) return false
    if (filtro === "pendientes") return !a.habilitado
    if (filtro === "habilitados") return a.habilitado
    if (filtro === "manuales") return a.metodo_voto === "manual"
    if (filtro === "email_fallido") return Boolean(a.email && !a.credencial_email_enviado_en)
    if (filtro === "sms_fallido") return Boolean(a.telefono && !a.credencial_sms_enviado_en)
    if (filtro === "dispositivo") return Boolean(a.dispositivo_alerta_en)

    return true
  })

  const cargarAsambleistas = useCallback(async () => {
    const res = await fetch("/api/oficina/asambleistas")
    const data = await res.json()

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo cargar la lista de asambleístas", "Could not load assembly members"))
      return
    }

    setAsambleistas(data.asambleistas || [])
  }, [t])

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

    if (data.credencialEmail) {
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

    if (data.credencialSms) {
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

  const ejecutarEnvioCredencial = async (
    id: string,
    nombre: string,
    accion: "activar_credencial" | "reenviar_credencial" | "reenviar_email" | "reenviar_sms"
  ) => {
    const mensajeConfirmacion =
      accion === "activar_credencial"
        ? t(
            `¿Activar a ${nombre}? Esto registrará el pago, habilitará su participación y enviará sus credenciales.`,
            `Activate ${nombre}? This will record payment, approve participation, and send credentials.`
          )
        : accion === "reenviar_email"
          ? t(`¿Reenviar email a ${nombre}?`, `Resend email to ${nombre}?`)
          : accion === "reenviar_sms"
            ? t(`¿Reenviar SMS a ${nombre}?`, `Resend SMS to ${nombre}?`)
            : t(`¿Reenviar credenciales a ${nombre}?`, `Resend credentials to ${nombre}?`)

    if (
      !window.confirm(mensajeConfirmacion)
    ) {
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
      alert(data.error || t("No se pudo completar la acción", "Could not complete the action"))
      return
    }

    await cargarAsambleistas()
    alert(
      [
        accion === "activar_credencial"
          ? t("Asambleísta activado", "Assembly member activated")
          : t("Reenvío procesado", "Resend processed"),
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
      alert(t("Primero debes preparar una asamblea", "You must prepare an assembly first"))
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

    let creados = 0
    const errores: string[] = []

    for (const [indice, linea] of lineas.slice(1).entries()) {
      const valores = parsearLineaCsv(linea)
      const fila = Object.fromEntries(
        encabezados.map((campo, posicion) => [campo, valores[posicion] || ""])
      )

      if (!String(fila.nombre || "").trim()) {
        errores.push(`Fila ${indice + 2}: falta nombre`)
        continue
      }

      const res = await fetch("/api/oficina/asambleistas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asambleaId,
          nombre: fila.nombre,
          email: fila.email,
          telefono: fila.telefono,
          metodoVoto: fila.metodo_voto === "manual" ? "manual" : "electronico",
          iglesia: fila.iglesia,
          distrito: fila.distrito,
          enviarCredenciales: false,
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        errores.push(`Fila ${indice + 2}: ${data?.error || "no se pudo crear"}`)
        continue
      }

      creados += 1
    }

    setCsvProcesando(false)
    setCsvArchivo(null)
    await cargarAsambleistas()

    alert(
      [
        `Pre-registros creados: ${creados}`,
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
      alert(t("Primero debes preparar una asamblea", "You must prepare an assembly first"))
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
        `Asambleísta creado: ${data.asambleista.credencial}`,
        ...avisosEnvio,
      ].join("\n")
    )
  }

  const prepararAsamblea = async () => {
    if (!nuevaOrganizacion.trim() || !nuevoAnio.trim() || !nuevoLugar.trim()) {
      alert(t("Completa organización, año y lugar", "Complete organization, year, and location"))
      return
    }

    await crearAsambleaPreparacion()
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

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6f5b1d]">
                {t("Asamblea", "Assembly")}
              </p>
              {asambleaId ? (
                <>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {organizacionAsamblea || organizacionNombreSesion}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {t("Año", "Year")}: {anioAsamblea || "N/A"} · {t("Lugar", "Location")}:{" "}
                    {lugarAsamblea || "N/A"} Â·{" "}
                    <span className="font-black text-[#16382f]">
                      {estadoAsamblea === "preparacion"
                        ? t("Preparada para registro", "Prepared for registration")
                        : estadoAsamblea === "receso"
                          ? t("En receso", "In recess")
                          : t("Iniciada", "Started")}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {t("Preparar nueva asamblea", "Prepare new assembly")}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {t(
                      "Registro puede crear la asamblea antes de que el moderador inicie los trabajos.",
                      "Registration can create the assembly before the moderator starts proceedings."
                    )}
                  </p>
                </>
              )}
            </div>

            {!asambleaId && (
              <div className="grid w-full gap-3 lg:max-w-3xl lg:grid-cols-[1.2fr_0.7fr_1fr_auto]">
                <input
                  type="text"
                  placeholder={t("Organización", "Organization")}
                  value={nuevaOrganizacion}
                  onChange={(e) => setNuevaOrganizacion(e.target.value)}
                  className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                />
                <input
                  type="text"
                  placeholder={t("Año", "Year")}
                  value={nuevoAnio}
                  onChange={(e) => setNuevoAnio(e.target.value)}
                  className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                />
                <input
                  type="text"
                  placeholder={t("Lugar", "Location")}
                  value={nuevoLugar}
                  onChange={(e) => setNuevoLugar(e.target.value)}
                  className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                />
                <button
                  type="button"
                  onClick={prepararAsamblea}
                  className="h-11 rounded-lg bg-[#16382f] px-4 font-bold text-white transition hover:bg-[#0f2b24]"
                >
                  {t("Preparar", "Prepare")}
                </button>
              </div>
            )}
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-5">
          <button
            type="button"
            onClick={() => setFiltro("pendientes")}
            className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-left shadow-sm transition hover:bg-amber-100"
          >
            <p className="text-xs font-black uppercase tracking-wide text-amber-700">
              {t("Pendientes", "Pending")}
            </p>
            <p className="mt-2 text-3xl font-black text-amber-900">
              {resumenOperacion.pendientes}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFiltro("email_fallido")}
            className="rounded-lg border border-red-100 bg-red-50 p-4 text-left shadow-sm transition hover:bg-red-100"
          >
            <p className="text-xs font-black uppercase tracking-wide text-red-700">
              {t("Email pendiente", "Email pending")}
            </p>
            <p className="mt-2 text-3xl font-black text-red-900">
              {resumenOperacion.emailFallido}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFiltro("sms_fallido")}
            className="rounded-lg border border-red-100 bg-red-50 p-4 text-left shadow-sm transition hover:bg-red-100"
          >
            <p className="text-xs font-black uppercase tracking-wide text-red-700">
              {t("SMS pendiente", "SMS pending")}
            </p>
            <p className="mt-2 text-3xl font-black text-red-900">
              {resumenOperacion.smsFallido}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFiltro("dispositivo")}
            className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-left shadow-sm transition hover:bg-indigo-100"
          >
            <p className="text-xs font-black uppercase tracking-wide text-indigo-700">
              {t("Dispositivos", "Devices")}
            </p>
            <p className="mt-2 text-3xl font-black text-indigo-900">
              {resumenOperacion.dispositivos}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFiltro("manuales")}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50"
          >
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              {t("Manuales", "Manual")}
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {resumenOperacion.manuales}
            </p>
          </button>
        </section>

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
            disabled={cargando}
            className="mt-4 rounded-lg bg-[#16382f] px-4 py-2.5 font-bold text-white transition hover:bg-[#0f2b24] disabled:opacity-40"
          >
            {t("Crear asambleísta", "Create assembly member")}
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
                  "Carga asambleístas antes del evento sin enviar credenciales. Luego usa Activar asambleísta para registrar pago, habilitar y enviar credenciales.",
                  "Load assembly members before the event without sending credentials. Then use Activate member to record payment, approve, and send credentials."
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
                disabled={csvProcesando || cargando || !csvArchivo}
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
          <div className="space-y-4 border-b border-slate-200 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-black text-slate-950">
                {t("Lista de asambleístas", "Assembly member list")}
              </h2>
              <p className="text-sm font-bold text-slate-500">
                {asambleistasFiltrados.length} / {asambleistas.length}
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder={t("Buscar por nombre, credencial, email o celular", "Search by name, credential, email, or phone")}
                className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
              />
              <select
                value={filtro}
                onChange={(event) => setFiltro(event.target.value as typeof filtro)}
                className="h-11 rounded-lg border border-slate-200 px-3 font-bold text-slate-700 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
              >
                <option value="todos">{t("Todos", "All")}</option>
                <option value="pendientes">{t("Pendientes de activar", "Pending activation")}</option>
                <option value="habilitados">{t("Habilitados", "Approved")}</option>
                <option value="manuales">{t("Voto manual", "Manual vote")}</option>
                <option value="email_fallido">{t("Email pendiente/fallido", "Email pending/failed")}</option>
                <option value="sms_fallido">{t("SMS pendiente/fallido", "SMS pending/failed")}</option>
                <option value="dispositivo">{t("Validación de dispositivo", "Device validation")}</option>
              </select>
            </div>
          </div>

          {asambleistas.length === 0 && (
            <p className="p-5 text-slate-500">{t("No hay registros", "No records")}</p>
          )}

          <div>
            {asambleistas.length > 0 && asambleistasFiltrados.length === 0 && (
              <p className="p-5 text-slate-500">
                {t("No hay resultados con ese filtro.", "No results match that filter.")}
              </p>
            )}

            {asambleistasFiltrados.map((a) => (
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
                      disabled={
                        cargando ||
                        Boolean(
                          a.registrado && a.pago_confirmado && a.habilitado
                        )
                      }
                      onClick={() => ejecutarEnvioCredencial(a.id, a.nombre, "activar_credencial")}
                      className="h-10 rounded-lg bg-[#16382f] px-3 text-sm font-bold text-white disabled:opacity-40"
                    >
                      {t("Activar asambleísta", "Activate member")}
                    </button>

                    {a.email && (
                      <button
                        disabled={cargando}
                        onClick={() => ejecutarEnvioCredencial(a.id, a.nombre, "reenviar_email")}
                        className="h-10 rounded-lg bg-blue-600 px-3 text-sm font-bold text-white disabled:opacity-40"
                      >
                        {a.credencial_email_enviado_en
                          ? t("Reenviar email", "Resend email")
                          : t("Enviar email", "Send email")}
                      </button>
                    )}

                    {a.telefono && (
                      <button
                        disabled={cargando}
                        onClick={() => ejecutarEnvioCredencial(a.id, a.nombre, "reenviar_sms")}
                        className="h-10 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-40"
                      >
                        {a.credencial_sms_enviado_en
                          ? t("Reenviar SMS", "Resend SMS")
                          : t("Enviar SMS", "Send SMS")}
                      </button>
                    )}

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
