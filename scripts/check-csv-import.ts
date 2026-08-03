import assert from "node:assert/strict"
import { prepararPreRegistroMasivo } from "../lib/preRegistroMasivo"

const filas = Array.from({ length: 250 }, (_, indice) => ({
  fila: indice + 2,
  nombre: `Persona ${indice + 1}`,
  email: `persona${indice + 1}@example.com`,
  telefono: `616555${String(indice).padStart(4, "0")}`,
  iglesia: "ICP",
  distrito: "Indiana",
  metodoVoto: indice % 2 ? "manual" : "electronico",
}))

filas.push({
  fila: 252,
  nombre: "Email inválido",
  email: "correo-invalido",
  telefono: "",
  iglesia: "ICP",
  distrito: "Indiana",
  metodoVoto: "electronico",
})

const { registros, errores } = prepararPreRegistroMasivo({
  filas,
  codigoTenant: "Kingdom Tech",
  credencialesOcupadas: new Set(),
})

assert.equal(registros.length, 250)
assert.equal(new Set(registros.map((registro) => registro.credencial)).size, 250)
assert.ok(registros.every((registro) => registro.credencial.startsWith("KINGD-")))
assert.equal(errores.length, 1)
assert.match(errores[0], /Fila 252: email inválido/)

console.log("CSV bulk import check passed")
