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
  votacion_id?: string
  visible_asambleistas?: boolean | null
}

export type ConteoCandidato = {
  id: string
  nombre: string
  votos: number
  porcentaje: number
}

export type TipoMocion =
  | "resolucion_principal"
  | "enmienda"
  | "enmienda_a_enmienda"

export type Mocion = {
  id: string
  titulo: string
  tipo_mocion: TipoMocion
  mocion_padre_id: string | null
  resolucion_raiz_id: string | null
  estado: string
  estado_parlamentario: string | null
  resultado: string | null
}
