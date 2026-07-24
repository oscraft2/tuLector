# Catálogo de instrumentos DIA — Monitoreo Intermedio 2026 (5° y 6° básico)

Documentación de la estructura real de las 4 hojas de respuesta oficiales de la Agencia de Calidad
de la Educación (plataforma **DIA**) que el usuario tiene en su Escritorio, para poder configurar
el ensayo equivalente en tuLector de cada una (ver `docs/plan-hoja-dia-motor.md` para la
arquitectura: tuLector genera su propia hoja con esta misma estructura, no lee el PDF oficial
crudo) y así producir el CSV que alimenta a **dia-bot** (ya funcional en producción para
`SELECCION_UNICA_SIMPLE`, ver `dia-bot/docs/FINDINGS.md`).

**Método:** lectura visual directa de cada PDF de hoja de respuestas (no inferido ni adivinado).
Existen además `ficha_tecnica_lectura_monitoreo_2026_5_basico.pdf`, `ficha_tecnica_matematica_
monitoreo_2026_5_basico.pdf`, `pauta sexto leng.pdf` y `pauta sexto mat.pdf` en el mismo
Escritorio — **están protegidos con contraseña, no se pudieron abrir** en esta sesión. Si el
usuario tiene la contraseña, compartirlos permitiría confirmar el código exacto de
`tipoPregunta` que usa la API de DIA para cada ítem abierto (`ABIERTA_SIMPLE` /
`ABIERTA_PAR_ORDENADO` / `ABIERTA_ENTERO_DECIMAL`, ya vistos en vivo por dia-bot en otro
instrumento — ver sección 3) en vez de inferirlo por la forma del casillero impreso.

## 1. Lectura 5° básico

Archivo: `hoja_de_respuestas_lectura_monitoreo_2026_5_basico.pdf`. **27 preguntas**, todas
selección única A-B-C-D salvo:
- **P5, P17**: pregunta de desarrollo (casillero "Pregunta de desarrollo", sin burbujas).

Sin opciones variables, sin selección múltiple. Es la más simple de las 4 — **se puede configurar
hoy mismo con el mecanismo `openQuestions` ya existente en producción**, sin necesitar las
extensiones del motor (`optionOverrides`/`multiSelectQuestions`) hechas para esta feature.

**Config tuLector:**
```
numQuestions = 27
numOptions = 4
openQuestions = 5, 17
```

## 2. Lectura 6° básico

Archivo local: `hoja leng.pdf` (el nombre del archivo no sigue la convención `hoja_de_respuestas_
lectura_monitoreo_2026_6_basico.pdf` de los demás — el título impreso confirma que es "Lectura 6º
básico"; vale la pena renombrarlo para que la carpeta quede consistente). **28 preguntas**, todas
A-B-C-D salvo:
- **P5, P23**: pregunta de desarrollo.

Misma estructura que Lectura 5° (solo cambia el total y la posición de las 2 abiertas). Tampoco
necesita las extensiones nuevas del motor.

**Config tuLector:**
```
numQuestions = 28
numOptions = 4
openQuestions = 5, 23
```

## 3. Matemática 5° básico

Archivo: `hoja_de_respuestas_matematica_monitoreo_2026_5_basico.pdf`. **35 preguntas**, la más
heterogénea de las 4 — tiene ítems que NO son "Pregunta de desarrollo" genérica sino variantes de
respuesta corta/numérica con su propio casillero impreso:

| Pregunta | Tipo impreso | Clasificación tuLector |
|---|---|---|
| 1, 2, 4, 8–10, 13–20, 22–24, 26–28, 30, 32–35 | A-B-C-D (4 opciones) | selección única, estándar |
| **6, 11, 25, 29** | A-B-C (3 opciones) | selección única, `optionOverrides` |
| **3** | "Ingresa los números" (4 casilleros) | abierta — numérica corta |
| **7** | 1 casillero ("—") | abierta — corta (numérica o texto, no se puede saber por la hoja) |
| **12** | `( □ ; □ )` — par ordenado | abierta — **par ordenado** |
| **21** | "Pregunta de desarrollo" | abierta — desarrollo extenso |
| **31** | 1 casillero sin etiqueta | abierta — corta (mismo caso que P7) |

Sin ítems de selección múltiple ("marca todas las correctas").

Para tuLector, **las 5 abiertas (3, 7, 12, 21, 31) se tratan todas igual** (sin burbujas, van al
reverso, fuera del puntaje automático) — el motor no distingue subtipos de abierta, solo
"tiene burbujas" vs "no tiene". La distinción de subtipo (par ordenado / numérica / desarrollo) SÍ
importa más adelante para **dia-bot Fase B** (ver sección 3): el payload que espera la API de DIA
para una `ABIERTA_PAR_ORDENADO` no es el mismo que para una `ABIERTA_ENTERO_DECIMAL`.

**Config tuLector:**
```
numQuestions = 35
numOptions = 4
openQuestions = 3, 7, 12, 21, 31
optionOverrides = 6:3, 11:3, 25:3, 29:3
```

## 4. Matemática 6° básico

Archivo: `hoja_de_respuestas_matematica_monitoreo_2026_6_basico.pdf`. **35 preguntas** (ya
documentado en detalle en `docs/plan-hoja-dia-motor.md`, resumen aquí para el catálogo):

| Pregunta | Tipo | Clasificación tuLector |
|---|---|---|
| resto | A-B-C-D | selección única, estándar |
| **20** | A-B-C (3 opciones) | selección única, `optionOverrides` |
| **7, 15, 18** | "Pregunta de desarrollo" | abierta |
| **29** | "Marca todas las correctas" (6 casillas 1-6) | **selección múltiple** |

Es la única de las 4 con un ítem de selección múltiple — motivó la extensión
`multiSelectQuestions` del motor (`docs/plan-hoja-dia-motor.md`).

**Config tuLector:**
```
numQuestions = 35
numOptions = 4
openQuestions = 7, 15, 18
optionOverrides = 20:3
multiSelectQuestions = 29
```

## 5. Comparación rápida

| Evaluación | Preguntas | Abiertas | Opciones variables | Selección múltiple | Requiere las extensiones nuevas del motor |
|---|---|---|---|---|---|
| Lectura 5° | 27 | 5, 17 | — | — | No |
| Lectura 6° | 28 | 5, 23 | — | — | No |
| Matemática 5° | 35 | 3, 7, 12, 21, 31 | 6, 11, 25, 29 → 3 opc. | — | Sí (`optionOverrides`) |
| Matemática 6° | 35 | 7, 15, 18 | 20 → 3 opc. | 29 | Sí (`optionOverrides` + `multiSelectQuestions`) |

**Patrón que se repite:** Lenguaje/Lectura en ambos grados es 100% selección única + desarrollo
(el caso ya soportado desde antes de esta feature). Matemática en ambos grados agrega ítems
"raros" que no son selección única simple ni desarrollo genérico — variables por instrumento
(par ordenado y numérica en 5°, selección múltiple en 6°), lo que sugiere que **instrumentos DIA
futuros de Matemática probablemente sigan trayendo tipos de ítem nuevos** que no calcen en las
categorías ya vistas. La arquitectura elegida (openQuestions genérico + optionOverrides +
multiSelectQuestions, todos aditivos) ya cubre lo visto hasta ahora; un tipo de ítem realmente
nuevo (ej. arrastrar-y-soltar, emparejar columnas) requeriría evaluarse caso a caso cuando
aparezca — no hay forma de anticiparlo sin verlo.

## 6. Pendiente para conectar con dia-bot (Fase B, no construida)

Ninguna de las 4 evaluaciones se puede cargar hoy a la plataforma DIA vía dia-bot más allá de sus
preguntas `SELECCION_UNICA_SIMPLE` (Fase 1 ya en producción). Antes de extender
`dia-bot/src/answer_payload.js` para los tipos nuevos que aparecen en este catálogo, falta el
mismo paso de **captura pasiva en vivo** que el proyecto ya usó para `ABIERTA_*`/`FINALIZAR`
(`dia-bot/docs/FINDINGS.md` §11-12) — confirmar contra la API real de DIA:
- El código exacto de `tipoPregunta` para "marca todas las correctas" (hipótesis:
  `SELECCION_MULTIPLE`, no confirmado).
- Los códigos y payloads de los subtipos de abierta vistos en Matemática 5°: par ordenado
  (`ABIERTA_PAR_ORDENADO`, ya confirmado que existe como código real en otro instrumento — FINDINGS
  §11.4) y numérica corta (`ABIERTA_ENTERO_DECIMAL`, misma fuente) — falta verificar cuál de los 3
  ítems "raros" de Matemática 5° (P3, P7, P31) corresponde a cuál código exacto.

Sin este paso, cualquier extensión de `answer_payload.js` para estos tipos sería una suposición no
verificada — mismo criterio que ya costó una sesión larga de debugging con `ABIERTA_*` la primera
vez (FINDINGS.md §11.3-11.4).
