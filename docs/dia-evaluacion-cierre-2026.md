# Instrumentos DIA - Evaluación de Cierre 2026

## Metadatos

- **Programa**: Diagnóstico Integral de Aprendizajes (DIA)
- **Agencia**: Agencia de Calidad de la Educación (Mineduc - Chile)
- **Año**: 2026
- **Periodo**: Evaluación de Cierre (Noviembre 2026)
- **Asignaturas**: Lectura (Lenguaje) y Matemática
- **Niveles auditados**: 7° Básico, 8° Básico, I Medio, II Medio
- **Total instrumentos auditados**: 7
  - Lectura: 7° básico, 8° básico, I medio, II medio
  - Matemática: 8° básico, I medio, II medio

---

## 1. Resumen de Instrumentos y Estructura

| Nivel y Asignatura | ID Preset | Preg. | Alternativas (A-D) | Abiertas / Desarrollo | Completación / Específico | Selección Múltiple |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **7° Básico - Lectura** | `dia_cierre_7b_lectura` | 30 | 29 | **P6** (Código 2/1/0) | — | — |
| **8° Básico - Lectura** | `dia_cierre_8b_lectura` | 31 | 30 | **P19** (Código 2/1/0) | — | — |
| **I Medio - Lectura** | `dia_cierre_1m_lectura` | 35 | 34 | **P13** (Código 2/1/0) | — | — |
| **II Medio - Lectura** | `dia_cierre_2m_lectura` | 38 | 37 | **P15** (Código 2/1/0) | — | — |
| **8° Básico - Matemática** | `dia_cierre_8b_matematica` | 37 | 33 | **P14** (Código 2/1/0) | **P1** (`-70`), **P37** (`-13`) | **P30** (`1 y 3`) |
| **I Medio - Matemática** | `dia_cierre_1m_matematica` | 38 | 36 | **P9** (Código 2/1/0) | **P32** (`4`) | — |
| **II Medio - Matemática** | `dia_cierre_2m_matematica` | 39 | 36 | **P29** (Código 2/1/0) | **P27** (`(0,-2)`), **P33** (`5`) | — |

---

## 2. Detalle de Claves y Pautas Oficiales

### 2.1 Lectura 7° Básico (`dia_cierre_7b_lectura`)
- **Total preguntas**: 30
- **Clave**: `BDDCB-CDACABADCDDBBDBBDCBBCAAC`
- **P6 (Desarrollo - Reflexionar / OA 8)**:
  - *Código 2*: Formula interpretación sobre la enseñanza respecto a la apariencia física y fundamenta coherentemente con información del texto (motivación del rey para ocultar su aspecto y/o consecuencias de sus acciones).
  - *Código 1*: Formula interpretación pero fundamenta con aspectos locales del relato demostrando comprensión parcial.
  - *Código 0*: Interpretación no relacionada, percepciones sin evidencia del texto o en blanco.

### 2.2 Lectura 8° Básico (`dia_cierre_8b_lectura`)
- **Total preguntas**: 31
- **Clave**: `CCBDDCBACBADAACBBD-CDADACBCDBCA`
- **P19 (Desarrollo - Interpretar y relacionar / OA 7)**:
  - *Código 2*: Interpreta por qué a Luis “le hará bien” la crisis económica del padre y fundamenta coherentemente aludiendo a las consecuencias de la escasez de dinero en su vida.
  - *Código 1*: Comprensión parcial o aspectos locales.
  - *Código 0*: Sin fundamentación o en blanco.

### 2.3 Lectura I Medio (`dia_cierre_1m_lectura`)
- **Total preguntas**: 35
- **Clave**: `BDDAADACADDC-AADBDDBDDABBCBACDBDDAC`
- **P13 (Desarrollo - Reflexionar / OA 9)**:
  - *Código 2*: Formula postura escogiendo con qué punto de vista de ambos textos está de acuerdo y fundamenta con comprensión de ambos textos.
  - *Código 1*: Fundamenta con comprensión parcial o local, o de solo uno de los textos.
  - *Código 0*: Sin postura coherente o en blanco.

### 2.4 Lectura II Medio (`dia_cierre_2m_lectura`)
- **Total preguntas**: 38
- **Clave**: `DBBCBBDBDCADAC-BCAABDDDBBCCAACCBBDCACA`
- **P15 (Desarrollo - Reflexionar / OA 10)**:
  - *Código 2*: Opina cuál enfoque le parece más adecuado y fundamenta coherentemente con aspectos característicos de ambos enfoques.
  - *Código 1*: Comprensión parcial o local sin evaluar beneficios y consecuencias globales.
  - *Código 0*: Incoherente o en blanco.

### 2.5 Matemática 8° Básico (`dia_cierre_8b_matematica`)
- **Total preguntas**: 37
- **Clave**: `-ADCDCADBCCDB-BCBBDACABDCBBDA-AACBBD-`
- **P1 (Completación)**: `-70` (max_points: 1)
- **P14 (Desarrollo - Argumentar y comunicar / OA 15)**:
  - *Código 2*: Marca "No", argumenta que 2 caras y 1 sello tiene 3 combinaciones y 2 sellos y 1 cara también tiene 3 combinaciones (o usando las 3 ramas del diagrama de árbol).
  - *Código 1*: Marca "No" pero sólo señala que son iguales sin fundamentar con el árbol.
  - *Código 0*: Marca "Sí", incorrecto o en blanco.
- **P30 (Selección Múltiple)**: Respuestas correctas `1 y 3` (opciones 1-4).
- **P37 (Completación)**: `-13` (max_points: 1)

### 2.6 Matemática I Medio (`dia_cierre_1m_matematica`)
- **Total preguntas**: 38
- **Clave**: `ACDBBDAD-BABACBADBBDDCBCADCBDCC-DBCADC`
- **P9 (Desarrollo - Resolver problemas / OA 4)**:
  - *Código 2*: Plantea y resuelve sistema $a + c = 12$ y $2a + 3c = 33$. Responde 3 autos y 9 camionetas.
  - *Código 1*: Plantea sistema correcto con error algebraico pero solución positiva coherente, o plantea 1 ecuación correcta.
  - *Código 0*: Sin planteamiento o en blanco.
- **P32 (Completación)**: `4` (max_points: 1)

### 2.7 Matemática II Medio (`dia_cierre_2m_matematica`)
- **Total preguntas**: 39
- **Clave**: `DBCCDDADCCABCBADBBDA CBCACC-B-ACA-CBCACC` (sin espacios)
- **P27 (Completación par ordenado)**: `(0,-2)` o `(0;-2)` (max_points: 1)
- **P29 (Desarrollo - Resolver problemas / OA 2)**:
  - *Código 2*: Encuentra función inversa $g^{-1}(x) = 4x - 12$, evalúa en $x=10$ y obtiene $g^{-1}(10) = 28$.
  - *Código 1*: Halla la inversa pero no evalúa en 10, o error algebraico pero evalúa correctamente en 10.
  - *Código 0*: Incorrecto o en blanco.
- **P33 (Completación)**: `5` (max_points: 1)

---

## 3. Integración en tuLector

1. **Presets automáticos**: En `/dashboard/quizzes/nueva`, al seleccionar "Generar prueba DIA" se despliega el `<optgroup>` **Evaluación de Cierre 2026 (Finales)**.
2. **Generación de Hoja OMR**: Configurada automáticamente con 4 opciones (A-D), anclas de alineación, código de ensayo y áreas para preguntas abiertas al reverso.
3. **Calificación**: En `/dashboard/quizzes/[id]/abiertas` se despliegan las rúbricas oficiales para calificar con Código 0, 1 o 2 (apoyado por transcripción Gemini).
4. **Exportación**: Al exportar resultados se genera el CSV ministerial compatible con la plataforma DIA y con `dia-bot-extension`.
