export type ResultadoCerrado = {
  id: string
  titulo: string
  tipo_mayoria: string
  tipo_votacion: string
  votosEmitidos: number
  votosAFavor: number
  votosEnContra: number
  votosNecesarios: number
  aprobado: boolean
  ganadorNombre?: string
  resultado?: string
}

export type Candidato = {
  id: string
  nombre: string
}

export type ConteoCandidato = {
  id: string
  nombre: string
  votos: number
  porcentaje: number
}