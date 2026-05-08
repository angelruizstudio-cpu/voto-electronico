export const calcularNecesarios = (total: number, tipo: string) => {
  if (total === 0) return 0
  if (tipo === "dos_tercios") return Math.ceil((2 / 3) * total)
  return Math.floor(total / 2) + 1
}

export const mostrarTipoMayoria = (tipo: string) => {
  if (tipo === "dos_tercios") return "Dos terceras partes"
  return "Mayoría simple"
}

export const mostrarTipoVotacion = (tipo: string) => {
  if (tipo === "eleccion_lideres") return "Elección de Líderes Regionales"
  return "Resolución"
}

export const mostrarTipoMocion = (tipo: string) => {
  if (tipo === "enmienda") return "Enmienda"
  if (tipo === "enmienda_a_enmienda") return "Enmienda a la enmienda"
  return "Resolución principal"
}

export const mostrarEstadoParlamentario = (estado: string | null | undefined) => {
  if (estado === "esperando_segundo") return "Esperando segundo"
  if (estado === "secundada") return "Secundada"
  if (estado === "en_votacion") return "En votación"
  if (estado === "aprobada") return "Aprobada"
  if (estado === "rechazada") return "Rechazada"
  if (estado === "incorporada") return "Incorporada"
  return "Presentada"
}

export const claseRanking = (index: number) => {
  if (index === 0) return "bg-green-100 border-green-300"
  if (index === 1) return "bg-yellow-100 border-yellow-300"
  if (index === 2) return "bg-orange-100 border-orange-300"
  return "bg-white"
}
