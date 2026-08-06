import assert from "node:assert/strict"
import { crearRecargaSerial } from "../hooks/useVotacion"

async function main() {
  const recargar = crearRecargaSerial()
  const iniciadas: string[] = []
  let simultaneas = 0
  let maximoSimultaneas = 0

  const tarea = (nombre: string) => async () => {
    iniciadas.push(nombre)
    simultaneas += 1
    maximoSimultaneas = Math.max(maximoSimultaneas, simultaneas)
    await new Promise((resolve) => setTimeout(resolve, 20))
    simultaneas -= 1
  }

  await Promise.all([
    recargar(tarea("primera")),
    recargar(tarea("segunda")),
    recargar(tarea("ultima")),
  ])

  assert.equal(maximoSimultaneas, 1)
  assert.deepEqual(iniciadas, ["primera", "ultima"])

  console.log("Voting refresh serialization check passed")
}

void main()
