# Saga de Cell: prueba de concepto

Previs de 12 s armada en HyperFrames. Los recuadros punteados (`CLIP A1` … `CLIP C2`) son los espacios
para los planos animados de los personajes; todo lo demás (escenarios, aura SSJ2, rayos, líneas de
velocidad, cuadros de impacto, choque de Kamehamehas, cortes y cierre) ya es la composición final.

| Escena | Tiempo | Espacios |
| --- | --- | --- |
| `compositions/standoff.html` | 0–4 s | A1 Gohan SSJ2 (aura), A2 Cell Perfecto |
| `compositions/clash.html` | 4–8 s | B1 Goku se suma, B2 intercambio de golpes, B3 Cell despedido |
| `compositions/beam.html` | 8–12 s | C1 Kamehameha padre e hijo, C2 Kamehameha de Cell |

Para reemplazar un espacio: poner el clip generado en `assets/` y cambiar el `<div class="…-slot">`
por un `<video muted playsinline>` con el mismo tamaño y posición (sin fondo, o con canal alfa).

Las fotos de referencia muestran figuras de **Vegeta** y **Cell Perfecto** (no Goku ni Gohan):
sirven como referencia de pose, no de personaje.

```bash
npx hyperframes check
npx hyperframes render --quality looks --output renders/dbz-cell-poc-previs.mp4
```
