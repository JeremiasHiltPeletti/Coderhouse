# DESIGN.md · Sunnygafas

Sistema fijado por el brief. No se reemplaza; este archivo lo resume y agrega las decisiones de aplicación.

## Mundo visual
Óptica de barrio con buena luz de tarde: lienzo blanco o crema, fotografía que pone el color, títulos editoriales en Gloock, UI precisa en Hanken Grotesk. El dorado es la firma del logo y aparece una vez por viewport. El segundo color, `mar`, carga la información útil (precio con transferencia, polarizadas, confianza).

## Motivo: los rayos
Líneas finas doradas (1–1.5px) que salen de una semicircunferencia, como en el isotipo. Uso de contenido:
- **Escala de colecciones:** la cantidad de rayos marca el nivel (Básica 3 · Esencial 5 · Superior 7 · Élite 9) sobre `ink`. Es el único lugar donde el motivo informa algo.
- Separador mínimo junto al logo en el footer.
Nunca franjas radiales rellenas, nunca de fondo, nunca sobre `mar`.

## Tokens
| Token | HEX | Uso |
|---|---|---|
| white | #FFFFFF | Lienzo de compra, cards, inputs |
| arena-50 | #FFFAF2 | Lienzo de páginas de marca |
| arena-100 | #F7EEDF | Una banda editorial por pantalla (pre-footer de newsletter) |
| piedra | #F2F0EC | Fondo de fotos de producto y placeholders |
| ink | #1E1A16 | Texto, botón primario, barra de anuncios, footer, una banda por página de marca |
| ink-muted | #6B5F53 | Texto secundario (6.2:1 sobre white) |
| on-ink-muted | #B5AA9D | Secundario sobre ink (7.6:1) |
| line | #8C7D6C | Bordes de input y botón secundario (4.0:1) |
| line-soft | #E6D8C3 | Filetes decorativos |
| oro | #C48A36 | Logo, rayos, badge descuento, detalles sobre ink (5.8:1 sobre ink) |
| oro-strong | #85561A | Hover del primario |
| oro-soft | #F4E6CC | Solo fondo del badge Nuevo |
| mar | #1D5A60 | Precio transferencia, Polarizada, íconos de confianza, una banda por página de marca |
| mar-soft | #D9EBE8 | Fondo de Polarizada, tablas técnicas, círculos de íconos |
| whatsapp | #1F7A4D | Solo botón de WhatsApp |
| success / error | #2E6F3A / #B3261E | Estados con texto |

## Tipografía
Gloock 400 (títulos): Display 48/50 · 72/72, H1 36/40 · 48/52, H2 28/32 · 36/40, H3 22/28.
Hanken Grotesk (UI): Body 16/24, Body-lg 18/28, Small 14/20, Botón 16/600, Eyebrow 12/16/700 +0.08em mayúsculas (solo barra de anuncios y labels de dato; nunca encima de un título), precios 700/800 tabulares.

## Forma
Escala 4px. Márgenes 16 / 64. Máx. 1280. Sección 48 / 96. Radios 6 (inputs), 12 (botones, cards, fotos), 24 (banners), pill (badges, chips, swatches). Sombras solo en hover y en lo que flota. Transiciones 150–250ms.

## Reglas de dosis
1. Un momento dorado de contenido por viewport. El header (logo + barra de anuncios) cuenta como un único bloque de marca.
2. Crema solo en páginas de marca; compra en white con fotos sobre piedra.
3. Páginas de marca: al menos una banda ink y una mar.
4. Ninguna banda de color compite con una foto grande en el mismo viewport.
5. Nunca oro sobre mar ni oro como texto sobre claro.

## Fotos de producto
`object-fit: contain` sobre piedra con `mix-blend-mode: multiply`, así el fondo blanco de las fotos actuales se funde con piedra y todas las cards quedan parejas sin re-editar las imágenes.
