import assert from "node:assert/strict"
import { crearHtmlCredenciales } from "../lib/credencialesImpresion"

const html = crearHtmlCredenciales({
  organizacion: "Organizacion <Regional>",
  evento: "Asamblea 2026",
  credenciales: [{
    nombre: "<script>alert(1)</script>",
    credencial: "KTG-123-456",
    iglesia: "ICP",
    distrito: "Indiana",
    qrDataUrl: `data:image/png;base64,${Buffer.from("VOTOAPP:KTG-123-456").toString("base64")}`,
  }],
  etiquetas: {
    nombre: "Nombre",
    iglesia: "Iglesia",
    distrito: "Distrito",
    credencial: "Credencial",
    imprimir: "Imprimir",
  },
})

assert.match(html, /width: 2in; height: 3in/)
assert.ok(html.includes("data:image/png;base64,"))
assert.ok(!html.includes("<script>alert(1)</script>"))

console.log("Credential print check passed")
