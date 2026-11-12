---
name: revision-codigo
description: Revisión completa de código para cualquier lenguaje y tecnología. En una sola llamada revisa todo el código del proyecto y reporta qué está mal y qué se puede mejorar, con sugerencias mayores y menores: errores, redundancia, mejor enfoque para lo requerido, seguridad, rendimiento, buenas prácticas y estándares actuales, legibilidad. Usar cuando el usuario pida "revisar código", "code review", "¿qué está mal?", "¿qué se puede mejorar?", "¿se puede hacer mejor?", "buenas prácticas" o "eliminar redundancia".
---

# Revisión de código

Objetivo: revisar **todo** el código y responder en un solo reporte **qué está mal y qué se puede mejorar**, incluyendo tanto sugerencias mayores como menores. Cada punto debe tener motivo concreto y alternativa concreta.

## 1. Qué revisar

- Si el usuario pegó código en el chat, revisar ese código.
- Si no, revisar **todo el código fuente del proyecto**: listar los archivos (`git ls-files` o Glob) y leerlos todos.
- Excluir lo que no es código propio: dependencias (`node_modules`, `vendor`, `venv`), builds (`dist`, `build`, `.next`, `target`), lockfiles, archivos minificados, binarios e imágenes.
- Si el proyecto es muy grande, priorizar la lógica principal y los cambios recientes (`git log`, `git diff`), y aclarar en el reporte qué quedó fuera.

## 2. Entender el contexto antes de juzgar

1. **Stack real**: lenguaje y versión, framework y runtime, según los manifiestos (`package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `*.csproj`, `composer.json`, `Dockerfile`…). No recomendar features que esa versión no soporte.
2. **Convenciones del proyecto**: linters, formatters, `tsconfig`, `.editorconfig`, `CONTRIBUTING`, `CLAUDE.md`. Mandan sobre las preferencias generales.
3. **Propósito**: qué tiene que hacer el código (README, nombres, comentarios, tests, commits). "¿Se puede hacer mejor?" se responde respecto de eso.
4. **Lo que ya existe**: antes de sugerir crear una utilidad, buscar si el proyecto, la librería estándar o el framework ya la tienen.
5. Ante dudas sobre deprecaciones o estándares recientes, verificar en la documentación oficial antes de afirmar.

## 3. Qué buscar

Recorrer el código con todos estos ejes:

**Errores y corrección**
- Casos borde: vacíos, `null`/`undefined`/`None`, cero, negativos, fechas y zonas horarias.
- Errores no manejados o silenciados (`catch {}`, `except: pass`).
- Asincronía: promesas sin `await`, `forEach` con `async`, condiciones de carrera.
- Recursos sin liberar: archivos, conexiones, listeners, timers.
- Lógica: condiciones invertidas, off-by-one, `==` vs `===`, mutación inesperada de datos, selectores o rutas que no existen.

**Enfoque y diseño**
- ¿Hay una solución nativa más simple (librería estándar, feature del framework, propiedad CSS, constraint de base de datos)?
- ¿Otra estructura de datos lo simplifica (Set, Map/dict)?
- ¿Se hace en la capa correcta (filtrar en la DB y no en memoria, validar en el borde)?
- ¿Sobre-ingeniería (abstracciones sin uso, YAGNI) o sub-diseño (funciones gigantes, responsabilidades mezcladas)?

**Redundancia**
- Código duplicado o casi duplicado que debería extraerse a una función, componente o clase.
- Reimplementar lo que ya dan el lenguaje, el framework o el proyecto.
- Dependencias innecesarias (ej. jQuery, moment o lodash cuando lo nativo alcanza).
- Código muerto: funciones, variables, imports, CSS, archivos sin uso, código comentado.
- Condiciones redundantes (`if (x) return true; else return false;`, `else` tras `return`).
- Cálculos repetidos, estado derivado duplicado, comentarios que sólo repiten el código.

**Seguridad**
- Inyección: SQL, comandos, XSS (`innerHTML`, `eval`). Rutas armadas con entrada del usuario.
- Secretos o tokens en el código.
- Validación de entrada y autorización del lado del servidor.
- Hash de contraseñas inseguro y `Math.random()` para tokens.
- Cookies y CORS mal configurados.
- Dependencias vulnerables o abandonadas.

**Rendimiento** (sólo cuando tiene impacto real)
- Loops anidados evitables y consultas N+1.
- Trabajo repetido dentro de loops.
- I/O secuencial que podría ser concurrente.
- Frontend: imágenes pesadas o sin dimensiones/lazy-loading, scripts bloqueantes, re-renders innecesarios.

**Buenas prácticas y estándares actuales**
- Idioms modernos de la versión usada y APIs no deprecadas.
- Tipado donde el ecosistema lo espera.
- `const` e inmutabilidad por defecto.
- Configuración por entorno, no hardcodeada.
- Manejo de errores idiomático.
- Principios DRY, KISS, YAGNI y responsabilidad única, aplicados con criterio.
- Ejemplos por tecnología:
  - **JS/TS**: no `var`, ES modules, `async/await`, `?.` y `??`, `fetch`, `addEventListener` en vez de handlers inline, delegación de eventos, `strict`.
  - **HTML/CSS**:
    - HTML semántico (`header`, `nav`, `main`, `button` y no `div` clickeable).
    - `alt` en imágenes, `label` en formularios, contraste y foco visible.
    - `lang` y meta viewport.
    - Layout con Flexbox/Grid, variables CSS y unidades relativas (`rem`, `clamp()`).
    - Mobile-first, sin `!important` ni estilos inline repetidos.
  - **Python**: type hints, f-strings, `pathlib`, `dataclasses`, context managers, `logging`.
  - **Java/C#/Kotlin**: records, nullability/`Optional`, try-with-resources/`using`, inyección de dependencias.
  - **Go**: errores envueltos con `%w`, `context`, `defer`.
  - **SQL**: consultas parametrizadas, índices, sin `SELECT *`, transacciones.
  - **Shell**: `set -euo pipefail`, variables entre comillas.
  - **Docker/CI**: versiones fijadas, multi-stage, usuario no root, secretos fuera de la imagen.

**Legibilidad y mantenibilidad**
- Nombres que expresan intención (no `aux`, `data2`, `temp`).
- Funciones cortas, early return en vez de anidamiento profundo.
- Sin números ni strings mágicos.
- Consistencia de estilo, idioma y estructura de carpetas.

**Tests**
- Si la lógica importante tiene tests, si cubre casos borde y errores, y si es testeable.

## 4. Reglas

- **Evidencia**: cada punto cita `archivo:línea` y explica el problema concreto (qué falla, qué riesgo trae o qué cuesta).
- **Alternativa siempre**: mostrar el código propuesto (antes → después), no sólo "se podría mejorar".
- **Justificar el "mejor"**: más simple, más seguro, menos código, estándar actual, evita un bug.
- **Verificar antes de reportar**: confirmar que el "duplicado" no tiene diferencias sutiles, que lo "sin uso" no se usa en otro archivo, que lo "deprecado" lo está en la versión del proyecto.
- **Respetar el proyecto**: no proponer cambiar de framework o arquitectura salvo que el enfoque actual sea claramente inadecuado; en ese caso, explicar el costo.
- **Agrupar lo repetido**: si el mismo problema aparece en muchos lugares, reportarlo una vez listando todas las ubicaciones.
- **Incluir mayores y menores**: no omitir sugerencias menores, pero sí separarlas de las importantes.
- **Sólo reportar**: no modificar archivos durante la revisión; al final, ofrecer aplicar los cambios.

## 5. Formato del reporte

Responder en el idioma del usuario:

~~~markdown
## Resumen
<Qué se revisó (archivos), stack detectado, veredicto general y cantidad de puntos: X críticos, Y mayores, Z menores.>

## 🔴 Críticos — lo que está mal
<Bugs, vulnerabilidades, cosas que no funcionan o no cumplen lo requerido.>

### 1. <título corto>
**Dónde:** `ruta/archivo.ext:42`
**Problema:** <qué está mal y por qué importa>
**Solución:**
```<lenguaje>
// antes
...
// después
...
```
**Por qué es mejor:** <razón concreta>

## 🟠 Mayores — mejoras importantes
<Redundancia real, mejor enfoque, prácticas desactualizadas, rendimiento, mantenibilidad. Mismo formato.>

## 🟡 Menores — detalles y pulido
<Nombres, pequeñas simplificaciones, consistencia, accesibilidad menor. Formato breve: `archivo:línea` — problema → sugerencia (con código si ayuda).>

## Enfoque general
<Sólo si toda la solución podría plantearse de otra forma más simple o robusta: describirla con un esquema de código.>

## Lo que está bien
<Puntos fuertes concretos, breve.>

## Próximos pasos
<Lista priorizada. Preguntar si se quieren aplicar los cambios.>
~~~

Si una sección no tiene puntos, poner "Sin observaciones." en lugar de inventar problemas.
