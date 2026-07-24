# Catálogo de instrumentos DIA — Monitoreo Intermedio 2026 (5° básico a II medio)

Documentación de la estructura real de las hojas de respuesta oficiales de la Agencia de Calidad
de la Educación (plataforma **DIA**) que el usuario tiene en su Escritorio, para poder configurar
el ensayo equivalente en tuLector de cada una (ver `docs/plan-hoja-dia-motor.md` para la
arquitectura: tuLector genera su propia hoja con esta misma estructura, no lee el PDF oficial
crudo) y así producir el CSV que alimenta a **dia-bot**.

**Método:** lectura visual directa de cada PDF de hoja de respuestas (no inferido ni adivinado).
Existen además fichas técnicas y pautas de corrección en el mismo Escritorio — **están protegidas
con contraseña, no se pudieron abrir** en esta sesión.

**Cobertura: 11 de 12 instrumentos posibles** (5°/6°/7°/8° básico + I/II medio, × Lectura y
Matemática). **Falta Matemática 8° básico** — no hay PDF en el escritorio para ese; no se debe
inventar su estructura ni agregar un preset para él hasta tenerlo.

## Tabla completa

| Nivel | Asignatura | Preguntas | Abiertas (nº: tipo) | Opciones variables | Selección múltiple |
|---|---|---|---|---|---|
| 5° básico | Lectura | 27 | 5, 17: desarrollo | — | — |
| 5° básico | Matemática | 35 | 3: numérica (4 casilleros), 7: corta, 12: par ordenado, 21: desarrollo, 31: corta | 6:3, 11:3, 25:3, 29:3 | — |
| 6° básico | Lectura | 28 | 5, 23: desarrollo | — | — |
| 6° básico | Matemática | 35 | 7, 15, 18: desarrollo | 20:3 | **29** (6 casillas) |
| 7° básico | Lectura | 30 | 25: desarrollo | — | — |
| 7° básico | Matemática | 35 | 6, 12, 29, 33: corta; 15: desarrollo | 16:3 | — |
| 8° básico | Lectura | 31 | 20: desarrollo | — | — |
| 8° básico | Matemática | **sin PDF — no documentado** | | | |
| I medio | Lectura | 35 | 6: desarrollo | — | — |
| I medio | Matemática | 38 | 9: desarrollo, 12: par ordenado, 32: corta | — | — |
| II medio | Lectura | 38 | 27: desarrollo | — | — |
| II medio | Matemática | 39 | 27: par ordenado, 29: desarrollo, 33: corta | — | — |

Archivos fuente: `hoja_de_respuestas_<lectura|matematica>_monitoreo_2026_<nivel>.pdf` en el
escritorio (6° Lectura vive como `hoja leng.pdf`, nombre inconsistente con el resto — vale la pena
renombrarlo).

## Patrones confirmados (con 11 instrumentos ya vistos)

- **Lenguaje/Lectura, en TODOS los niveles, es 100% uniforme**: selección única A-B-C-D + entre 1
  y 2 preguntas de desarrollo genérico. Nunca opciones variables, nunca selección múltiple, nunca
  ítems numéricos/par-ordenado. Se configura con `openQuestions` solamente — el mecanismo que ya
  existía en tuLector antes de esta feature, sin necesitar `optionOverrides`/`multiSelectQuestions`.
- **Matemática es la asignatura heterogénea**: opciones variables (3 en vez de 4) en 5°/6°/7°;
  selección múltiple SOLO vista en 6° básico (P29, "marca todas las correctas") — no se repite en
  ningún otro nivel de los 11 auditados; ítems de respuesta corta/numérica/par-ordenado presentes
  en 5°, 7°, I medio y II medio (ausentes en 6°).
- Las abiertas "raras" de Matemática (no "Pregunta de desarrollo" genérica) tienen 3 formas
  impresas distintas, cada una mapeable a un subtipo:
  - `( □ ; □ )` → **par ordenado**
  - Un casillero corto suelto (con o sin guion "—") → **numérica corta**
  - "Ingresa los números" con varios casilleros → **numérica de varias cifras** (mismo tipo que la
    anterior, solo más dígitos)
  - "Pregunta de desarrollo" (con más espacio) → **desarrollo extenso**

## Hallazgo clave: códigos reales de DIA para las abiertas de Matemática (confirmado, no hipótesis)

**Matemática II medio (39 preguntas, abiertas en 27/29/33) es el mismo instrumento que dia-bot ya
cargó en producción** — `dia-bot/docs/FINDINGS.md` §11.4 documenta, con captura pasiva real contra
la API de DIA: *"de 39 preguntas, solo 3 son de desarrollo de verdad: posiciones 27, 29 y 33
(ABIERTA_PAR_ORDENADO, ABIERTA_SIMPLE, ABIERTA_ENTERO_DECIMAL respectivamente)"*.

Esto **confirma** (deja de ser hipótesis) el mapeo forma-impresa → código real de DIA:

| Forma impresa | Código DIA confirmado |
|---|---|
| `( □ ; □ )` par ordenado | `ABIERTA_PAR_ORDENADO` |
| "Pregunta de desarrollo" | `ABIERTA_SIMPLE` |
| Casillero corto suelto | `ABIERTA_ENTERO_DECIMAL` |
| "Ingresa los números" (varios casilleros) | consistente con `ABIERTA_ENTERO_DECIMAL` (no confirmado 1:1, mismo tipo de dato) |

Relevante para: (a) el prompt de la IA de corrección (`docs/plan-correccion-ia-abiertas.md`) — debe
saber qué tipo de dato extraer por cada abierta, no tratarlas todas igual; (b) la Fase B de dia-bot
— ya no hace falta una sesión nueva de captura pasiva solo para conocer estos 3 códigos, solo para
confirmar el payload exacto de `SELECCION_MULTIPLE` (que sigue sin verse en ningún instrumento
excepto 6° básico Matemática).

## Config lista para tuLector (referencia — ya cableada en `src/lib/dia_presets.ts`)

Los 11 instrumentos ya están como presets automáticos en el formulario de creación de ensayo
(`AnswerKeyEditor.tsx`, selector "Instrumento DIA") — no hace falta tipear esta config a mano, se
deja acá solo como referencia/auditoría:

```
5° Básico - Lectura:      27 preguntas, openQuestions=5,17
5° Básico - Matemática:   35 preguntas, openQuestions=3,7,12,21,31, optionOverrides=6:3,11:3,25:3,29:3
6° Básico - Lectura:      28 preguntas, openQuestions=5,23
6° Básico - Matemática:   35 preguntas, openQuestions=7,15,18, optionOverrides=20:3, multiSelectQuestions=29
7° Básico - Lectura:      30 preguntas, openQuestions=25
7° Básico - Matemática:   35 preguntas, openQuestions=6,12,15,29,33, optionOverrides=16:3
8° Básico - Lectura:      31 preguntas, openQuestions=20
8° Básico - Matemática:   SIN PRESET (falta el PDF)
I Medio - Lectura:        35 preguntas, openQuestions=6
I Medio - Matemática:     38 preguntas, openQuestions=9,12,32
II Medio - Lectura:       38 preguntas, openQuestions=27
II Medio - Matemática:    39 preguntas, openQuestions=27,29,33
```

## Pendiente para conectar con dia-bot (Fase B, no construida)

Ver `docs/plan-correccion-ia-abiertas.md` y el plan unificado de la sesión (Fase 3-4) para el
detalle completo. Resumen:
- **Selección múltiple** (solo 6° básico Matemática): falta captura pasiva del código real de
  `tipoPregunta` (hipótesis `SELECCION_MULTIPLE`) + extender `dia-bot/src/answer_payload.js`.
- **Abiertas**: los 3 códigos ya están confirmados (tabla arriba); falta que la Fase de IA entregue
  un puntaje/transcripción CONFIRMADO por el profesor, extender el CSV de tuLector con esas
  columnas, y extender `answer_payload.js` con una rama `ABIERTA_*` que escriba
  `respuestaEscalar`/`respuestaAbierta` según el subtipo.
