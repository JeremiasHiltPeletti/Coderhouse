# Checklist detallada de revisión

Referencia para profundizar en cada eje de `SKILL.md`. No hace falta recorrerla entera en cada revisión: usar las secciones relevantes al código y al stack.

---

## 1. Corrección

- [ ] Casos borde: colecciones vacías, `null`/`undefined`/`None`, cero, negativos, strings vacíos, Unicode, fechas/zonas horarias, límites de enteros.
- [ ] Errores: ¿se capturan los que pueden ocurrir? ¿Se tragan excepciones en silencio (`catch {}`, `except: pass`)? ¿Se pierde el stack/causa original?
- [ ] Asincronía: promesas sin `await`, `forEach` con `async`, carreras, falta de cancelación/timeouts, bloqueo del event loop.
- [ ] Recursos: archivos, conexiones, locks, listeners, timers, suscripciones que no se liberan (usar `using`/`with`/`defer`/`try-with-resources`/cleanup de efectos).
- [ ] Mutación inesperada de argumentos o estado compartido.
- [ ] Comparaciones: `==` vs `===`, igualdad de floats, comparación de objetos por referencia.
- [ ] Lógica: condiciones invertidas, off-by-one, `switch` sin `break`/default, precedencia de operadores.

## 2. Enfoque y diseño

Preguntas clave:
- ¿Cuál es el requerimiento real? ¿El código resuelve eso o algo más/menos?
- ¿Existe una solución nativa? (librería estándar, feature del framework, constraint de la base de datos, propiedad CSS, comando del sistema).
- ¿Otra estructura de datos simplifica todo? (Set para pertenencia, Map/dict para búsqueda, cola, árbol).
- ¿Se está haciendo en la capa correcta? (filtrar en la DB y no en memoria; validar en el borde; lógica de negocio fuera de la UI/controlador).
- ¿Declarativo vs imperativo? (`map/filter/reduce`, comprehensions, LINQ, streams, SQL set-based) cuando mejora claridad.
- ¿Sobre-ingeniería? Interfaces con una sola implementación sin razón, factories/patrones innecesarios, configuración para casos que no existen (YAGNI).
- ¿Sub-diseño? Funciones de cientos de líneas, "god objects", acoplamiento fuerte, responsabilidades mezcladas.
- ¿Es idempotente/reintentable donde debería?

## 3. Redundancia

- [ ] Bloques duplicados o casi duplicados (copiar-pegar con cambios menores) → extraer función/componente/parámetro.
- [ ] Reimplementar utilidades existentes: del lenguaje (ej. `Array.prototype.includes`, `Object.groupBy`, `structuredClone`, `itertools`, `pathlib`, `slices`/`maps` en Go), del framework, o del propio proyecto (buscar en `utils/`, `helpers/`, `lib/`, `common/`).
- [ ] Dependencias redundantes: librería para algo que ya hace la plataforma (ej. lodash/moment/jQuery/axios cuando lo nativo alcanza), o dos librerías para lo mismo.
- [ ] Código muerto: funciones, ramas, imports, variables, parámetros, CSS y archivos sin uso; código comentado.
- [ ] Condiciones redundantes: `if (x === true)`, `if (cond) return true; else return false;`, chequeos repetidos, `else` tras `return`.
- [ ] Cálculos o consultas repetidas que se pueden calcular una vez.
- [ ] Estado derivado guardado por duplicado (ej. en React, `useState` + `useEffect` para algo calculable en render).
- [ ] Comentarios que repiten lo que dice el código (deberían explicar el *por qué*).
- [ ] Estilos/markup repetidos → clases utilitarias, variables CSS, componentes.

## 4. Seguridad

- [ ] Entrada no confiable concatenada en SQL, comandos de shell, HTML, rutas de archivos, regex, plantillas → usar parámetros/escapado/APIs seguras.
- [ ] Secretos, tokens, contraseñas o URLs internas en el código o en el repo → variables de entorno / gestor de secretos.
- [ ] Autorización verificada en el servidor, no sólo en el cliente.
- [ ] Hashing de contraseñas con algoritmos adecuados (argon2, bcrypt, scrypt), nunca MD5/SHA1 planos.
- [ ] Criptografía y aleatoriedad: usar generadores seguros (`crypto`), no `Math.random()` para tokens.
- [ ] `eval`, `innerHTML`, `dangerouslySetInnerHTML`, `pickle`, deserialización de datos no confiables.
- [ ] CORS, cookies (`HttpOnly`, `Secure`, `SameSite`), cabeceras de seguridad, CSRF.
- [ ] Mensajes de error que filtran información interna.
- [ ] Dependencias con vulnerabilidades conocidas o sin mantenimiento.

## 5. Rendimiento (sólo si hay impacto real)

- [ ] Complejidad evitable: loops anidados para búsquedas (usar índices/Map/Set).
- [ ] N+1 consultas; falta de paginación; traer columnas/filas de más.
- [ ] Trabajo invariante dentro de loops.
- [ ] I/O secuencial que podría ser concurrente (`Promise.all`, goroutines, `asyncio.gather`) — cuidando límites.
- [ ] Frontend: re-renders innecesarios, bundles grandes, imágenes sin optimizar/dimensiones/lazy-loading, layout thrashing, scripts bloqueantes.
- [ ] Memoria: listeners/timers no liberados, cachés sin límite, cargar archivos enteros cuando se puede streamear.

## 6. Buenas prácticas y estándares actuales

Generales:
- [ ] Usar la versión del lenguaje/framework del proyecto y sus idioms modernos; no recomendar lo que esa versión no soporta.
- [ ] Sin APIs deprecadas.
- [ ] Tipado explícito donde el ecosistema lo espera (TypeScript estricto, type hints, generics) y sin `any`/casts innecesarios.
- [ ] Inmutabilidad por defecto (`const`, `final`, `readonly`, tuplas/records/dataclasses frozen).
- [ ] Configuración por entorno, no valores hardcodeados.
- [ ] Logging estructurado en vez de `print`/`console.log` sueltos en código productivo.
- [ ] Manejo de errores idiomático (excepciones tipadas, `Result`, `error` en Go) y mensajes útiles.
- [ ] Principios con criterio: DRY sin abstracciones prematuras, KISS, YAGNI, responsabilidad única, composición sobre herencia.

Ejemplos por ecosistema (orientativos, verificar contra la versión real):
- **JavaScript/TypeScript**: `const`/`let` (no `var`), ES modules, `async/await`, optional chaining `?.` y `??`, `fetch` nativo, `addEventListener` en vez de handlers inline, delegación de eventos, `strict` en tsconfig, no mutar estado en React, keys estables en listas.
- **HTML/CSS**: HTML semántico (`header`, `nav`, `main`, `section`, `button` vs `div` clickeable), `alt` en imágenes, labels en formularios, contraste y foco visible (accesibilidad WCAG), Flexbox/Grid en vez de floats/posicionamiento absoluto para layout, variables CSS (custom properties), unidades relativas (`rem`, `%`, `clamp()`), mobile-first con media queries, sin `!important` salvo excepción, sin estilos inline repetidos, meta viewport.
- **Python**: type hints, f-strings, `pathlib`, `dataclasses`/`pydantic`, context managers, comprehensions legibles, `logging`, `ruff`/`black`, entornos virtuales y dependencias fijadas.
- **Java/Kotlin/C#**: records/data classes, `Optional`/nullable types, streams/LINQ con criterio, inyección de dependencias, try-with-resources/`using`, `var` donde mejora claridad.
- **Go**: errores envueltos con `%w`, `context.Context` propagado, `defer` para cleanup, interfaces chicas definidas por el consumidor, `go vet`/`golangci-lint`.
- **SQL**: consultas parametrizadas, índices para filtros/joins frecuentes, evitar `SELECT *`, transacciones donde corresponde, constraints en la DB.
- **Shell**: `set -euo pipefail`, comillas en variables, `shellcheck`.
- **Infra/Docker/CI**: imágenes base fijadas y livianas, multi-stage builds, usuario no root, secretos fuera de la imagen, caché de dependencias en CI.

## 7. Legibilidad y mantenibilidad

- [ ] Nombres que describen intención (sin abreviaturas crípticas, sin `data2`, `temp`, `aux`).
- [ ] Funciones cortas con una sola responsabilidad; parámetros acotados (objeto de opciones si son muchos).
- [ ] Early return / guard clauses en vez de anidamiento profundo.
- [ ] Sin números ni strings mágicos → constantes con nombre.
- [ ] Consistencia con el estilo del resto del proyecto (idioma de nombres, convención de casing, estructura de carpetas).
- [ ] Formato delegado a un formatter automático.

## 8. Testabilidad

- [ ] La lógica nueva tiene tests (o se puede testear sin montar todo el sistema).
- [ ] Dependencias externas inyectables/mockeables.
- [ ] Tests cubren casos borde y caminos de error, no sólo el camino feliz.
- [ ] Tests deterministas (sin depender de la hora, red o orden de ejecución).
