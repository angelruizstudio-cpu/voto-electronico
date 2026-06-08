# Manual del Sistema

## Sistema de Gestion de Asambleas y Votacion Electronica

Este manual describe el uso del sistema para administrar asambleas, participantes, asistencia, votaciones, elecciones, resultados y reportes oficiales.

El sistema esta organizado por roles:

- Administrador
- Moderador
- Comite de Escrutinio
- Oficina
- Puerta
- Asambleista

Cada rol ve las pantallas necesarias para cumplir su funcion dentro de la asamblea.

---

## 1. Pantalla de Acceso

Ruta:

```text
/login
```

La pantalla de acceso permite seleccionar el area de trabajo antes de iniciar sesion.

Areas disponibles:

- Administrador
- Moderador
- Comite de Escrutinio
- Oficina
- Puerta
- Asambleista

Para usuarios administrativos se requiere usuario y contrasena. Para asambleistas, el acceso se realiza con credencial desde la pantalla movil.

Uso:

1. Seleccionar el area correspondiente.
2. Escribir usuario y contrasena si aplica.
3. Presionar el boton de entrada.

Notas:

- Cada usuario solo debe entrar al area autorizada.
- El asambleista no usa usuario administrativo; usa su credencial.
- Si la pantalla muestra informacion anterior, refrescar con `Ctrl + F5`.

---

## 2. Administrador

Ruta:

```text
/admin
```

El Administrador controla los usuarios internos del sistema.

Funciones principales:

- Crear usuarios.
- Asignar roles.
- Activar o desactivar usuarios.
- Cambiar contrasenas.
- Administrar permisos de acceso.

Roles administrativos:

- Administrador: usuarios y permisos.
- Moderador: control de asamblea, mociones, votaciones y resultados.
- Comite de Escrutinio: registro de votos manuales y certificacion de resultado oficial.
- Oficina: registro, pagos, habilitacion e historial.
- Puerta: check-in y check-out.

Flujo recomendado:

1. Crear los usuarios antes del dia de la asamblea.
2. Asignar solo los roles necesarios.
3. Probar acceso de cada rol.
4. Desactivar usuarios que ya no deben entrar.

---

## 3. Moderador

Ruta principal:

```text
/moderador
```

El Moderador dirige el proceso parlamentario y controla las votaciones.

### Pantalla del Moderador

La pantalla esta organizada en dos columnas:

- Columna izquierda: asamblea activa, creacion de votaciones, resoluciones y enmiendas.
- Columna derecha: resultados del moderador, graficas, cierre, publicacion y rondas.

### Sidebar del Moderador

El panel lateral muestra:

- Usuario conectado.
- Estado de la asamblea.
- Organizacion.
- Ano y lugar.
- Quorum.
- Votacion actual.

El quorum se calcula con la cantidad de asambleistas que estan marcados como presentes por Puerta.

### Abrir Asamblea

Para abrir una asamblea:

1. Entrar como Moderador.
2. Escribir organizacion, ano y lugar.
3. Presionar abrir asamblea.

Solo debe haber una asamblea activa a la vez.

### Crear Resolucion

Para crear una resolucion:

1. Escribir el titulo.
2. Seleccionar `Resolucion`.
3. Escoger el tipo de mayoria:
   - Mayoria simple
   - Dos terceras partes
4. Escoger el tipo de mocion:
   - Resolucion principal
   - Enmienda
   - Enmienda a la enmienda
5. Presentar la mocion.
6. Marcar como secundada si recibe segundo.
7. Abrir votacion.

### Calculo de Mayoria

Para resoluciones, el sistema calcula usando votos validos:

```text
Votos validos = A favor + En contra
```

Las abstenciones se muestran en resultados, pero no cuentan para determinar la mayoria requerida.

Mayoria simple:

```text
floor(votos validos / 2) + 1
```

Dos terceras partes:

```text
ceil((2 / 3) * votos validos)
```

Ejemplos de dos terceras partes:

- 3 votos validos requieren 2.
- 4 votos validos requieren 3.
- 5 votos validos requieren 4.
- 6 votos validos requieren 4.

### Resultados del Moderador

La pantalla de resultados del moderador muestra:

- Estado.
- Tipo de mocion.
- Tipo de mayoria.
- Votos necesarios.
- Votos a favor.
- Votos en contra.
- Abstenciones.
- Barras visuales por opcion.
- Mensaje indicando si la mocion alcanza la mayoria requerida.

### Enmiendas

Cuando hay una enmienda activa:

- La resolucion principal queda protegida.
- Primero se procesa la enmienda.
- Luego se regresa a la resolucion principal.

Cuando hay una enmienda a la enmienda:

- La enmienda principal queda protegida.
- Primero se procesa la enmienda a la enmienda.
- Luego se regresa a la enmienda principal.

### Eleccion de Lideres

Para crear una eleccion:

1. Escribir el cargo o titulo, por ejemplo `Presidente`.
2. Seleccionar `Eleccion de lideres`.
3. Agregar candidatos iniciales si aplica.
4. Abrir votacion.
5. Permitir nominaciones si es primera ronda y aun no hay votos emitidos.
6. Cerrar votacion.

Reglas principales:

- La eleccion usa mayoria simple.
- Si ningun candidato alcanza mayoria, se puede crear una nueva ronda.
- En segunda ronda pasan los candidatos correspondientes.
- Si hay empate final, se puede registrar el ganador por sorteo fisico.

### Cerrar Asamblea

Al cerrar la asamblea, el sistema:

- Cierra procesos abiertos.
- Conserva el historial.
- Permite generar PDF de cierre.
- Deja disponible el acta de elecciones y resultados.

---

## 4. Oficina

Ruta:

```text
/oficina
```

Oficina administra el registro de asambleistas.

Funciones principales:

- Crear asambleistas.
- Registrar iglesia y distrito.
- Registrar email.
- Confirmar pago.
- Confirmar registro.
- Habilitar para votar.
- Enviar credenciales por email.
- Consultar resultados e historial.

### Crear Asambleista

1. Entrar como Oficina.
2. Completar los datos del asambleista.
3. Incluir email si se desea enviar credencial.
4. Crear el registro.

El sistema genera una credencial unica.

### Habilitacion

Para que un asambleista pueda votar debe:

1. Estar registrado.
2. Tener pago confirmado si aplica.
3. Estar habilitado.
4. Hacer check-in en Puerta.

### Envio de Credenciales

El sistema puede enviar credenciales por email usando Resend.

Variables necesarias:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
```

Para produccion se debe usar un dominio verificado.

---

## 5. Puerta

Ruta:

```text
/puerta
```

Puerta controla entrada y salida de participantes.

Funciones principales:

- Buscar por nombre, credencial, iglesia o distrito.
- Marcar check-in.
- Marcar check-out.
- Ver registrados.
- Ver presentes.
- Ver fuera.
- Ver habilitados.

### Check-in

1. Buscar al asambleista.
2. Confirmar que este habilitado.
3. Presionar `Check-in`.

Cuando una persona hace check-in:

- Queda marcada como presente.
- Cuenta para el quorum.
- Puede votar si tambien esta habilitada.

### Check-out

1. Buscar al asambleista.
2. Presionar `Check-out`.

Cuando una persona hace check-out:

- Deja de contar para quorum.
- No debe poder votar hasta volver a estar presente.

---

## 6. Asambleista

Ruta:

```text
/asambleista
```

La pantalla de asambleista esta disenada para uso movil.

Funciones principales:

- Entrar con credencial.
- Ver asamblea activa.
- Ver votacion actual.
- Votar en resoluciones.
- Votar en elecciones.
- Nominar candidatos cuando aplique.
- Ver resultados publicados.
- Ver historial.

### Acceso con Credencial

1. Entrar a la pantalla de Asambleista.
2. Escribir la credencial.
3. Presionar entrar.

El sistema valida:

- Que la credencial exista.
- Que pertenezca a la asamblea activa.
- Que el asambleista este habilitado.
- Que este presente en Puerta.

### Votacion de Resoluciones

Cuando hay una resolucion abierta, el asambleista ve botones para:

- A favor
- En contra

Cada asambleista solo puede votar una vez por votacion.

### Votacion de Elecciones

Cuando hay una eleccion abierta, el asambleista ve los candidatos.

Si hay mas de dos candidatos, se muestran en columnas para ahorrar espacio.

El titulo del cargo, por ejemplo `Presidente`, aparece centrado.

### Nominacion Directa

La nominacion directa aparece cuando:

- Es eleccion de lideres.
- Es primera ronda.
- La votacion esta abierta.
- Todavia no se han emitido votos.

Cuando un asambleista escribe un nombre, ese nombre queda asociado a su participacion y no se muestra automaticamente a los demas asambleistas.

Nota operativa actual:

En la primera ronda, los nombres escritos por un asambleista desde su pantalla quedan privados para los demas asambleistas. El Moderador conserva los candidatos oficiales que haya entrado, pero una nominacion escrita por un asambleista no aparece automaticamente en las pantallas de otros participantes.

Los nombres recibidos por balota manual se registran despues de cerrar la votacion desde el modulo del Comite de Escrutinio.

---

## 7. Comite de Escrutinio

Ruta:

```text
/escrutinio
```

El Comite de Escrutinio registra votos manuales despues de cerrar una votacion electronica.

Funciones principales:

- Ver votaciones cerradas.
- Registrar votos manuales por candidato.
- Registrar nombres escritos en primera ronda.
- Registrar balotas nulas.
- Registrar balotas danadas.
- Ver resultado oficial actualizado.
- Certificar que el resultado esta listo para el Moderador.

### Flujo de uso

1. Entrar como Comite de Escrutinio.
2. Seleccionar una votacion cerrada.
3. Registrar los votos manuales.
4. Guardar los votos manuales.
5. Revisar el resumen oficial.
6. Presionar `Certificar y enviar resultado`.

### Resultado de elecciones

La pantalla muestra:

- Nombre de la eleccion.
- Votos emitidos.
- Votos necesarios.
- Si hubo eleccion o no hubo eleccion.
- Votos por candidato.
- Balotas nulas.
- Balotas danadas.

### Resultado de resoluciones

La pantalla muestra:

- Nombre de la resolucion.
- Votos emitidos.
- Votos necesarios.
- Votos a favor.
- Votos en contra.
- Abstenciones.
- Si la resolucion fue aprobada o rechazada.

---

## 8. Resultados de Asambleista

Ruta:

```text
/asambleista/resultados
```

Esta pantalla permite al asambleista ver resultados publicados.

Puede mostrar:

- Resultados de resoluciones.
- Elecciones de lideres.
- Votos por candidato.
- Porcentajes.
- Estado de la votacion.

Los resultados dependen de lo que publique el Moderador.

---

## 9. Historial del Asambleista

Ruta:

```text
/asambleista/historial
```

Permite consultar informacion historica disponible para el asambleista.

---

## 10. Resultados Actuales

Rutas:

```text
/moderador/resultados
/oficina/resultados
```

Estas pantallas muestran el resumen de la votacion activa.

Incluyen:

- Estado.
- Tipo de votacion.
- Votos emitidos.
- Votos necesarios.
- Mocion.
- Tipo de mayoria.
- Votos a favor y en contra.
- Candidatos y porcentajes en elecciones.

---

## 11. Historial de Asambleas

Rutas:

```text
/historial
/moderador/historial
/oficina/historial
```

El historial permite consultar asambleas cerradas o registradas.

Desde el historial se puede abrir el detalle de una asamblea.

---

## 12. Detalle de Asamblea y PDF

Ruta:

```text
/historial/[id]
```

Esta pantalla muestra el detalle de una asamblea especifica.

Incluye:

- Elecciones de lideres.
- Resoluciones.
- Enmiendas.
- Resultados.
- Ganadores.
- Votos por candidato.
- Votos a favor, en contra y abstenciones.

### Descargar PDF

El boton `Descargar PDF` genera el reporte oficial de la asamblea.

El PDF incluye:

- Datos generales de la asamblea.
- Tabla historica de asuntos.
- Resoluciones y enmiendas.
- Acta de elecciones.
- Area de firmas oficiales.

### Acta de Elecciones

El acta de elecciones usa formato tipo tabla oficial.

Para cada cargo muestra:

- Titulo del cargo centrado, por ejemplo `PRESIDENTE`.
- Votos emitidos.
- Votos necesarios.
- Resultado de eleccion `Si - No`.
- Primera ronda.
- Segunda ronda.
- Candidatos.
- Votos por candidato.

Si existe tercera ronda, el sistema genera otra tabla para continuar el acta sin perder informacion.

---

## 13. Flujo Recomendado para una Asamblea Real

Antes de la asamblea:

1. Crear usuarios administrativos.
2. Verificar que Oficina, Puerta y Moderador puedan entrar.
3. Registrar asambleistas.
4. Confirmar pagos o habilitacion.
5. Enviar credenciales si se usara email.
6. Probar acceso desde un celular.

Durante la asamblea:

1. Moderador abre la asamblea.
2. Puerta marca check-in.
3. El quorum se actualiza con los presentes.
4. Moderador presenta resoluciones o elecciones.
5. Asambleistas votan desde sus dispositivos.
6. Moderador cierra y publica resultados.
7. Comite de Escrutinio registra votos manuales si aplica.
8. Puerta puede marcar check-out cuando corresponda.

Despues de la asamblea:

1. Moderador cierra la asamblea.
2. Se revisa el historial.
3. Se descarga el PDF.
4. Se archiva el reporte oficial.

---

## 14. Recomendaciones Tecnicas

- Usar conexion estable de internet.
- Probar el sistema antes de usarlo oficialmente.
- Reiniciar el servidor local si se ven datos viejos en desarrollo.
- Refrescar el navegador con `Ctrl + F5` si hay cache.
- En telefonos, reinstalar la PWA si no actualiza iconos o diseno.
- No compartir usuarios administrativos.
- Cada asambleista debe usar su propia credencial.

---

## 15. Glosario

Asamblea activa:
Asamblea actualmente abierta para registro, asistencia o votacion.

Quorum:
Cantidad de asambleistas presentes, calculada por check-in en Puerta.

Votos validos:
Votos a favor mas votos en contra. Se usan para calcular mayoria en resoluciones.

Abstencion:
Voto registrado como abstencion. Se muestra en resultados, pero no cuenta como voto valido para mayoria.

Mayoria simple:
Mas de la mitad de los votos validos.

Dos terceras partes:
Cantidad minima equivalente a dos tercios de los votos validos, redondeada hacia arriba.

Nominacion directa:
Nombre agregado por un asambleista durante una eleccion de lideres cuando la primera ronda aun no tiene votos emitidos.

Acta de elecciones:
Seccion del PDF que presenta resultados por cargo y por ronda en formato oficial.
