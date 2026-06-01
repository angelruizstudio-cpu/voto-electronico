# Ensayo de presentacion - Asamblea

Fecha objetivo: 8 de junio de 2026

## Preparacion

- Confirmar que Azure tenga variables de entorno actualizadas.
- Confirmar que Supabase tenga ejecutados los scripts recientes.
- Confirmar que el email de credenciales llega con codigo QR.
- Confirmar que APP_BASE_URL no duplique la ruta /asambleista.
- Mantener SMS como mejora pendiente si Sent/TCR aun no esta aprobado.

## Datos demo sugeridos

- Asamblea: Asamblea Regional 2026
- Lugar: Kingdom Tech Group
- Asambleistas electronicos: 6
- Asambleistas manuales: 2
- Resolucion demo: Aprobacion de presupuesto 2026
- Eleccion demo: Director de Ministerio

## Flujo critico

1. Iniciar sesion como moderador.
2. Abrir asamblea con anio, lugar y organizacion.
3. Ir a Oficina y crear asambleistas con email.
4. Confirmar que llegue el email con credencial y QR.
5. Marcar registrado y confirmar pago.
6. Habilitar asambleistas.
7. Ir a Puerta y marcar presentes usando busqueda o QR.
8. Verificar que el quorum suba en el panel administrativo.
9. En moderador, crear una resolucion.
10. Abrir votacion.
11. Entrar como asambleista con credencial electronica.
12. Emitir voto.
13. Cerrar votacion.
14. Registrar votos manuales si aplica.
15. Publicar o revisar resultados.
16. Crear una eleccion de lideres con candidatos.
17. Votar, cerrar ronda y revisar ganador o nueva ronda.
18. Probar receso y reanudacion si queda tiempo.
19. Cerrar asamblea.
20. Abrir historial y descargar/revisar PDF.

## Criterios de exito

- El email llega con QR y credencial correcta.
- Un asambleista no habilitado no puede votar.
- Un asambleista fuera/no presente no puede votar.
- Un asambleista manual no entra al voto electronico.
- Los votos manuales no exceden la cantidad de manuales presentes.
- Los resultados suman electronicos y manuales correctamente.
- El reporte incluye resultados, manuales y eventos de receso.
- El flujo se puede demostrar en menos de 15 minutos.

## Plan B de presentacion

- Si SMS no esta aprobado, presentar email con QR como canal funcional.
- Explicar SMS como integracion implementada, pendiente de aprobacion de carrier/TCR.
- Tener credenciales impresas o visibles para no depender de mensajes durante la demo.
