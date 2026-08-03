type CredencialImprimible = {
  nombre: string
  credencial: string
  iglesia: string | null
  distrito: string | null
  qrDataUrl: string
}

type EtiquetasCredencial = {
  nombre: string
  iglesia: string
  distrito: string
  credencial: string
  imprimir: string
}

function escaparHtml(valor: string) {
  return valor.replace(/[&<>'"]/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[caracter] || caracter)
}

export function crearHtmlCredenciales({
  organizacion,
  evento,
  credenciales,
  etiquetas,
}: {
  organizacion: string
  evento: string
  credenciales: CredencialImprimible[]
  etiquetas: EtiquetasCredencial
}) {
  const tarjetas = credenciales.map((persona) => {
    if (!persona.qrDataUrl.startsWith("data:image/png;base64,")) {
      throw new Error("QR_INVALIDO")
    }

    return `
      <article class="credencial">
        <header>
          <div class="organizacion">${escaparHtml(organizacion)}</div>
          <div class="evento">${escaparHtml(evento)}</div>
        </header>
        <div class="separador"></div>
        <dl>
          <div><dt>${escaparHtml(etiquetas.nombre)}</dt><dd>${escaparHtml(persona.nombre)}</dd></div>
          <div><dt>${escaparHtml(etiquetas.iglesia)}</dt><dd>${escaparHtml(persona.iglesia || "-")}</dd></div>
          <div><dt>${escaparHtml(etiquetas.distrito)}</dt><dd>${escaparHtml(persona.distrito || "-")}</dd></div>
          <div><dt>${escaparHtml(etiquetas.credencial)}</dt><dd class="codigo">${escaparHtml(persona.credencial)}</dd></div>
        </dl>
        <img src="${escaparHtml(persona.qrDataUrl)}" alt="QR ${escaparHtml(persona.credencial)}" />
      </article>
    `
  }).join("")

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escaparHtml(evento)}</title>
      <style>
        @page { size: letter portrait; margin: .25in; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #eef2f1; color: #0f172a; font-family: Arial, sans-serif; }
        .barra { position: sticky; top: 0; z-index: 1; display: flex; justify-content: center; padding: 14px; background: #16382f; }
        .barra button { border: 0; border-radius: 6px; padding: 10px 18px; background: #fff; color: #16382f; font: 700 14px Arial, sans-serif; cursor: pointer; }
        .hoja { display: grid; grid-template-columns: repeat(4, 2in); justify-content: center; gap: 12px; padding: 20px; }
        .credencial { width: 2in; height: 3in; overflow: hidden; break-inside: avoid; border: 1px dashed #94a3b8; background: #fff; padding: .12in; text-align: center; }
        .organizacion { min-height: .34in; font-size: 10.5px; font-weight: 800; line-height: 1.15; overflow-wrap: anywhere; }
        .evento { margin-top: 3px; font-size: 9px; line-height: 1.15; overflow-wrap: anywhere; }
        .separador { height: 1px; margin: 7px 0; background: #c8a957; }
        dl { margin: 0; }
        dl div { margin-top: 4px; }
        dt { display: inline; font-size: 8px; font-weight: 700; text-transform: uppercase; color: #475569; }
        dt::after { content: ": "; }
        dd { display: inline; margin: 0; font-size: 10px; font-weight: 700; line-height: 1.1; overflow-wrap: anywhere; }
        .codigo { color: #16382f; font-family: monospace; font-size: 11px; letter-spacing: .03em; }
        img { display: block; width: .92in; height: .92in; margin: 7px auto 0; }
        @media print {
          body { background: #fff; }
          .barra { display: none; }
          .hoja { grid-template-columns: repeat(4, 2in); gap: 0; padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="barra"><button type="button" onclick="window.print()">${escaparHtml(etiquetas.imprimir)}</button></div>
      <main class="hoja">${tarjetas}</main>
    </body>
  </html>`
}
