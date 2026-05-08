# Manual de Usuarios

## Sistema de Asamblea y Votación Electrónica

Este manual describe el uso básico del sistema de asamblea para los distintos roles: Administrador, Moderador, Oficina, Puerta y Asambleísta.

El sistema permite administrar una asamblea completa, incluyendo registro, control de asistencia, votaciones, resoluciones, enmiendas, elecciones de líderes, publicación de resultados, historial y reportes oficiales.

---

## 1. Acceso al Sistema

El acceso principal se realiza desde:

```text
/login
```

En la pantalla inicial se debe seleccionar el área de trabajo:

- Administrador
- Moderador
- Oficina
- Puerta
- Asambleísta

Luego se ingresa el usuario y la contraseña asignados.

Para el rol Asambleísta, el acceso se realiza desde la pantalla móvil mediante credencial de asamblea.

---

## 2. Administrador del Sistema

El Administrador tiene acceso a la configuración de usuarios y permisos.

### Funciones principales

- Crear usuarios del sistema.
- Asignar roles.
- Activar o desactivar usuarios.
- Cambiar contraseñas.
- Controlar quién puede acceder a cada área.

### Crear un usuario

1. Entrar al sistema como Administrador.
2. Ir al área **Administrador**.
3. Completar:
   - Nombre completo
   - Usuario
   - Contraseña inicial
   - Roles permitidos
4. Presionar **Crear usuario**.

### Roles disponibles

- **Administrador:** Maneja usuarios y permisos.
- **Moderador:** Controla asamblea, votaciones, resoluciones y resultados.
- **Oficina:** Maneja registro, pagos, habilitación e historial.
- **Puerta:** Maneja check-in y check-out.

---

## 3. Oficina

El área de Oficina se usa para preparar y administrar los asambleístas.

### Funciones principales

- Crear asambleístas.
- Registrar pago.
- Confirmar registro.
- Habilitar asambleístas para votar.
- Ver resultados actuales.
- Ver historial de asambleas.

### Crear asambleísta

1. Entrar como usuario con rol Oficina.
2. Ir a **Oficina**.
3. Escribir:
   - Nombre y apellido
   - Iglesia
   - Distrito
4. Presionar **Crear Asambleísta**.

El sistema generará una credencial automáticamente.

### Habilitar asambleísta

Para que una persona pueda votar debe cumplir el flujo:

1. Registrar.
2. Confirmar pago.
3. Habilitar.

Una persona no debe ser habilitada si no completó el registro y la confirmación de pago.

---

## 4. Puerta

El área de Puerta es para el equipo que controla entrada y salida.

### Funciones principales

- Buscar asambleístas por nombre, credencial, iglesia o distrito.
- Marcar check-in.
- Marcar check-out.
- Ver cuántos están presentes, fuera, registrados y habilitados.

### Check-in

1. Entrar al área **Puerta**.
2. Buscar al asambleísta.
3. Confirmar que esté habilitado.
4. Presionar **Check-in**.

### Check-out

1. Buscar al asambleísta.
2. Presionar **Check-out**.

Cuando una persona está fuera, no debe poder votar hasta regresar y estar presente nuevamente.

---

## 5. Moderador

El Moderador controla el desarrollo parlamentario de la asamblea.

### Funciones principales

- Abrir asamblea.
- Crear votaciones.
- Presentar resoluciones.
- Presentar enmiendas.
- Presentar enmiendas a la enmienda.
- Marcar mociones como secundadas.
- Abrir votaciones.
- Cerrar votaciones.
- Publicar resultados.
- Manejar elecciones de líderes por rondas.
- Cerrar la asamblea.
- Generar reporte de cierre.

### Abrir asamblea

1. Entrar como Moderador.
2. Completar año y lugar.
3. Presionar **Abrir**.

Solo debe haber una asamblea abierta a la vez.

### Crear votación de resolución

1. Escribir el título.
2. Seleccionar **Resolución**.
3. Seleccionar tipo de mayoría:
   - Mayoría simple
   - Dos tercios
4. Seleccionar tipo de moción:
   - Resolución principal
   - Enmienda
   - Enmienda a la enmienda
5. Presionar **Presentar moción**.

### Flujo parlamentario de resoluciones

El flujo básico es:

1. Presentar resolución principal.
2. Marcar como secundada.
3. Debatir y votar.
4. Cerrar votación.
5. Publicar resultados.

Si la resolución no recibe segundo, se debe marcar **No fue secundada**.

### Enmiendas

Si se presenta una enmienda a una resolución:

- Los botones de la resolución principal quedan deshabilitados.
- Primero debe completarse la votación de la enmienda.
- Luego se regresa a la resolución principal.

Si se presenta una enmienda a la enmienda:

- Los botones de la enmienda principal quedan deshabilitados.
- Primero debe completarse la votación de la enmienda a la enmienda.
- Luego se regresa a la enmienda principal.

Esto evita confusión y mantiene el orden parlamentario.

### Elección de líderes

1. Crear votación tipo **Elección de líderes**.
2. Añadir candidatos.
3. Abrir votación.
4. Cerrar votación.

Si nadie obtiene mayoría simple:

- El sistema puede crear una nueva ronda.
- En la segunda ronda pasan los candidatos correspondientes.
- Si llega a empate final, se registra el ganador por sorteo físico.

### Cerrar asamblea

Al presionar **Cerrar asamblea**, el sistema:

1. Cierra votaciones abiertas.
2. Marca salida de los asambleístas presentes.
3. Cierra la asamblea.
4. Genera el PDF de cierre.

---

## 6. Asambleísta

La pantalla del Asambleísta está diseñada para celular.

### Funciones principales

- Hacer check-in con credencial.
- Votar en resoluciones.
- Votar en elecciones de líderes.
- Nominar candidatos cuando aplique.
- Ver resultados publicados.
- Ver historial de asambleas.
- Salir del sistema.

### Acceso del asambleísta

1. Ir a **Asambleísta** desde el login principal.
2. Ingresar la credencial asignada.
3. Presionar **Entrar**.

El sistema valida que el asambleísta:

- Exista.
- Pertenezca a la asamblea activa.
- Esté habilitado.
- Esté presente.

### Votar

Cuando haya una votación abierta:

- Para resolución: seleccionar **A favor** o **En contra**.
- Para elección: seleccionar un candidato.

Cada asambleísta solo puede votar una vez por votación.

### Resultados

El asambleísta puede ver resultados cuando el Moderador los publica.

---

## 7. Historial y Reportes

El sistema conserva historial de asambleas pasadas.

Desde el historial se puede ver:

- Votaciones realizadas.
- Resoluciones.
- Enmiendas.
- Elecciones de líderes.
- Ganadores.
- Resultados por ronda.
- Reporte PDF.

### Reporte de cierre

El reporte de cierre incluye:

- Datos de la asamblea.
- Resultados generales.
- Acta de elecciones de líderes.
- Resoluciones y enmiendas.
- Área de firmas oficiales.
- Logo institucional.

---

## 8. Recomendaciones para Uso en Asamblea

Antes de iniciar una asamblea real:

1. Verificar que la asamblea esté abierta.
2. Confirmar que los usuarios administrativos puedan entrar.
3. Verificar que Oficina pueda crear y habilitar asambleístas.
4. Probar check-in y check-out desde Puerta.
5. Probar un voto desde un celular.
6. Probar publicación de resultados.
7. Probar generación del PDF.
8. Tener conexión estable de internet.
9. Tener una persona responsable de soporte técnico.

---

## 9. Notas Importantes

- Si una pantalla no cambia, refrescar con `Ctrl + F5`.
- Si el servidor de desarrollo está mostrando información vieja, reiniciar `localhost:3000`.
- Los usuarios administrativos deben cerrar sesión al terminar.
- El acceso de emergencia solo debe usarse para configuración inicial.
- Antes de usar en producción, se recomienda realizar una prueba completa con varios dispositivos.

