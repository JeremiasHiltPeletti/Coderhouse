---
name: revision-codigo
description: Revisión de calidad de código agnóstica de lenguaje y tecnología. Detecta redundancia y duplicación, evalúa si el enfoque elegido es el más adecuado para el requerimiento, verifica buenas prácticas y estándares actuales del ecosistema, y propone (o aplica) versiones mejores y más simples. Usar cuando el usuario pida "revisar código", "code review", "mejorar este código", "refactorizar", "¿se puede hacer mejor?", "eliminar redundancia", "buenas prácticas", o cuando quiera validar lo que escribió antes de commitear. Sirve para cualquier lenguaje (JS/TS, Python, Java, C#, Go, PHP, Rust, SQL, HTML/CSS, shell, IaC, etc.).
argument-hint: "[archivo | carpeta | diff | rama] [--fix] [--estricto]"
---

# Revisión de código

Objetivo: responder con evidencia a una sola pregunta — **¿lo que se escribió es la mejor forma razonable de resolver lo que se necesita, en este proyecto y con estándares actuales?** Si no lo es, mostrar exactamente cómo hacerlo mejor.

No es una revisión de estilo cosmético ni una lista de opiniones. Cada hallazgo debe tener un motivo concreto y una alternativa concreta.

## 1. Determinar el alcance

Según los argumentos:

- **Archivo(s) o carpeta** → revisar esos archivos completos.
- **Sin argumentos** → revisar los cambios pendientes: `git diff HEAD` (más archivos nuevos sin trackear con `git status --porcelain`). Si no hay cambios, revisar el último commit (`git show HEAD`). Si no hay git, preguntar qué revisar.
- **Rama o PR** → `git diff <base>...<rama>`.
- **Código pegado en el chat** → revisar ese fragmento.

Flags:
- `--fix` → después de reportar, aplicar las mejoras de severidad Alta y Media (ver sección 6).
- `--estricto` → incluir también hallazgos de severidad Baja y sugerencias opcionales.

## 2. Entender el contexto antes de juzgar

Nunca evaluar el código en el vacío. Antes de opinar:

1. **Identificar el stack real**: lenguaje y versión, framework, runtime. Buscar manifiestos (`package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `*.csproj`, `composer.json`, `Gemfile`, `Dockerfile`, etc.). La versión importa: no recomendar features que la versión del proyecto no soporta.
2. **Leer la configuración de calidad existente**: linters, formatters, `tsconfig`, `.editorconfig`, `ruff`/`eslint`/`prettier`/`golangci`, `CONTRIBUTING`, `CLAUDE.md`. Las convenciones del proyecto mandan sobre las preferencias generales.
3. **Entender el requerimiento**: qué tiene que hacer el código (commit message, nombre de la rama, issue, comentarios, tests, o preguntar si es ambiguo). La pregunta "¿se puede hacer mejor?" sólo tiene sentido respecto de lo que se necesita.
4. **Buscar lo que ya existe**: antes de marcar algo como "debería ser una función/utilidad", buscar (Grep/Glob) si el proyecto o sus dependencias ya lo resuelven. Reimplementar algo existente es redundancia.
5. Si hay dudas sobre el estándar actual de una herramienta o API (deprecaciones, versiones recientes), verificarlo en la documentación oficial antes de afirmarlo.

## 3. Ejes de revisión

Recorrer el código con estos ejes, en este orden de prioridad. El detalle y ejemplos por eje está en `references/checklist.md`; consultarlo cuando haga falta profundizar o ante un lenguaje específico.

1. **Corrección** — ¿hace lo que debe? Casos borde, null/undefined, errores no manejados, condiciones de carrera, off-by-one, async sin await, recursos sin cerrar. Un código elegante pero incorrecto es el peor resultado.
2. **Enfoque / diseño** — ¿es la estrategia adecuada para el problema? ¿Hay una forma estructuralmente más simple (otra estructura de datos, una función estándar de la librería, un patrón nativo del framework, una consulta en vez de un loop)? ¿Está sobre-ingenierizado (abstracciones especulativas, capas sin uso) o sub-diseñado (todo en una función gigante)?
3. **Redundancia** — código duplicado o casi duplicado, lógica repetida que debería extraerse, reimplementación de lo que ya da la librería estándar / el framework / el propio proyecto, código muerto, variables o imports sin uso, condiciones redundantes, cálculos repetidos, comentarios que repiten el código.
4. **Seguridad** — inyección (SQL, comandos, XSS), secretos hardcodeados, validación de entrada, autenticación/autorización, deserialización insegura, dependencias vulnerables o abandonadas.
5. **Rendimiento** — sólo cuando importa de verdad: complejidad innecesaria (O(n²) evitable), consultas N+1, trabajo repetido dentro de loops, re-renders evitables, carga de datos de más. No micro-optimizar a costa de legibilidad.
6. **Buenas prácticas y estándares actuales** — idioms modernos del lenguaje y versión usados, APIs deprecadas, convenciones del ecosistema, tipado, manejo de errores idiomático, accesibilidad y semántica (en frontend), configuración por entorno, principios SOLID/DRY/KISS/YAGNI aplicados con criterio.
7. **Legibilidad y mantenibilidad** — nombres claros, funciones con una responsabilidad, anidamiento excesivo (usar early return), números mágicos, consistencia con el resto del código.
8. **Testabilidad** — ¿se puede testear? ¿Faltan tests para la lógica nueva o los casos borde?

## 4. Reglas para los hallazgos

- **Evidencia, no opinión**: cada hallazgo cita `archivo:línea` y explica el problema concreto (qué falla, qué cuesta, qué riesgo trae).
- **Siempre con alternativa**: mostrar el código mejorado (antes → después), no sólo "esto se podría mejorar".
- **Justificar el "mejor"**: decir por qué la alternativa es superior (más simple, más segura, menos código, estándar del ecosistema, evita un bug). Si es sólo preferencia de estilo, no es un hallazgo.
- **Respetar el proyecto**: no proponer cambiar de librería/framework/arquitectura salvo que el enfoque actual sea claramente inadecuado para el requerimiento; en ese caso, explicar el costo del cambio.
- **No inflar la lista**: preferir pocos hallazgos importantes y verificados a muchos triviales. Lo que un formatter/linter arregla solo se menciona una vez como "configurar X", no línea por línea.
- **Verificar antes de reportar**: releer el código alrededor; confirmar que el "duplicado" no tiene diferencias sutiles, que la "variable sin uso" no se usa en otro archivo, que la API "deprecada" lo está en la versión del proyecto.
- **Reconocer lo que está bien**: si el código es correcto y adecuado, decirlo. "No encontré mejoras significativas" es una respuesta válida.

Severidades:
- **Alta** — bug, vulnerabilidad, pérdida de datos, o enfoque que no cumple el requerimiento.
- **Media** — redundancia real, enfoque claramente mejorable, práctica desactualizada/deprecada, problema de rendimiento con impacto, falta de manejo de errores.
- **Baja** — legibilidad, nombres, pequeñas simplificaciones. (Sólo se reportan con `--estricto` o si son muy pocas.)

## 5. Formato del reporte

Responder en el idioma del usuario, con esta estructura:

~~~markdown
## Resumen
<2–4 líneas: qué se revisó, stack detectado, veredicto general (¿es la mejor forma de resolverlo?) y cantidad de hallazgos por severidad.>

## Hallazgos

### [Alta] <título corto>
**Dónde:** `ruta/archivo.ext:42`
**Problema:** <qué está mal y por qué importa>
**Mejor enfoque:**
```<lenguaje>
// antes
...
// después
...
```
**Por qué es mejor:** <razón concreta>

### [Media] ...

## Enfoque general
<Sólo si aplica: si toda la solución podría plantearse de otra manera más simple/robusta, describirla brevemente con un esquema de código.>

## Lo que está bien
<Puntos fuertes concretos, breve.>

## Próximos pasos
<Lista priorizada de acciones. Si no se usó --fix, ofrecer aplicarlas.>
~~~

## 6. Aplicar cambios (`--fix` o si el usuario lo pide)

1. Aplicar primero los de severidad Alta, luego Media. Las Bajas sólo si el usuario lo pide.
2. Cambios mínimos y enfocados: no reformatear archivos enteros ni mezclar refactors no relacionados.
3. Mantener el comportamiento observable salvo que el hallazgo sea justamente un bug.
4. Después de editar, ejecutar las verificaciones que el proyecto tenga (tests, linter, type-check, build). Buscarlas en `package.json` scripts, `Makefile`, CI (`.github/workflows`), etc. Reportar el resultado real; si algo falla, decirlo y corregirlo o explicarlo.
5. Cerrar con un resumen de qué se cambió y qué quedó pendiente.
