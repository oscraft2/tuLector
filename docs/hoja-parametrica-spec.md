# Hoja paramétrica TuLector — Spec internacional

Documento de referencia para construir la **UI de configuración** y el **generador de
hoja paramétrico** (Fase C). Basado en investigación de los exámenes estandarizados
de los mercados objetivo. La idea: **una sola arquitectura** que genere la hoja
correcta para cada país/examen, sin hacerlo "por partes".

> Estado: investigación + spec de diseño. Aún NO implementado. El motor actual
> soporta 20 preguntas / 5 opciones / RUT fijo.

---

## 1. Investigación: tamaños reales por mercado

| País | Examen (referencia) | Máx. preguntas | Opciones | ID nacional |
|---|---|---|---|---|
| 🇨🇱 Chile | PAES — Ciencias | **80** (Lectora/M1 65, M2 55) | 5 (A-E) | **RUT** (8 díg + DV mód-11, K) |
| 🇵🇪 Perú | Admisión San Marcos (UNMSM) | **100** | 5 | **DNI** (8 díg) |
| 🇦🇷 Argentina | *(sin examen nacional único — ingreso libre/por universidad)* | — (uso de aula) | varía | **DNI** (7-8 díg) |
| 🇲🇽 México | EXANI-II (CENEVAL) | **168** | **3 (A-C)** | **CURP** (18 alfanuméricos) |
| 🇧🇷 Brasil | ENEM | **180** (90/día × 2) | 5 | **CPF** (11 díg + 2 DV mód-11) |
| 🇺🇸 USA | SAT 98 · ACT 131 (digital) / **215** (papel) | **~215** | 4 / 5 | — (SSN no se usa así) |

**Máximo técnico a soportar: ~200 preguntas** (ENEM 180 / ACT papel 215).

---

## 2. Hallazgos clave para el diseño

1. **El número de opciones NO es fijo:** México **3 (A-C)**, USA **4**, Chile/Brasil **5**.
   → La hoja y el motor deben soportar **opciones configurables (3/4/5)**.
2. **Máximo ~180-200 preguntas** → obliga a **layout multi-columna** (1 columna no alcanza).
3. **El ID es país-específico** (RUT/DNI/CPF/CURP), con distinta longitud y validación.
4. **RUT (Chile) y CPF (Brasil) comparten dígito verificador módulo 11** → la
   auto-verificación ya implementada para RUT **sirve para Brasil**.
5. **Doble uso del producto:**
   - *Volumen:* profesor califica su **prueba de aula** (10-50 preguntas). Debe ser barato/rápido.
   - *Gancho de marketing:* **ensayos** de los exámenes grandes (PAES/ENEM/EXANI).
   - El diseño paramétrico debe cubrir **ambos extremos** (20 → 200).

---

## 3. Descriptor de layout paramétrico (lo que la UI configura)

El generador, el motor y el fixture consumen UN solo descriptor (extiende
`src/lib/sheet_layout.ts`):

```ts
interface SheetConfig {
  // Preguntas
  numQuestions: number;        // 1..200
  numOptions: 3 | 4 | 5;       // A-C / A-D / A-E
  columns: 1 | 2 | 3 | 4;      // auto-sugerido por numQuestions

  // Identificación del alumno
  idField: "RUT" | "DNI_PE" | "DNI_AR" | "CPF" | "CURP" | "custom" | "none";

  // Marca / institución (zona segura, NO toca fiduciales)
  branding?: {
    logoDataUrl?: string;      // logo del colegio
    title?: string;            // membrete / nombre institución
    subtitle?: string;         // curso, asignatura, fecha
  };

  // Auto-identificación de la hoja (carga la clave correcta)
  formQr?: string;             // quiz_id codificado en QR (reemplaza ?key=)

  // Idioma de la UI de la hoja
  locale?: "es-CL" | "es-PE" | "es-AR" | "es-MX" | "pt-BR" | "en-US";
}
```

**Sugerencia de columnas por tamaño** (un columna ≈ 25-35 filas legibles):
- ≤ 30 preguntas → 1 columna
- 31-60 → 2 columnas
- 61-120 → 3 columnas
- 121-200 → 4 columnas

---

## 4. Campos de ID por país (grilla numérica + validación)

| Campo | Estructura de grilla | Validación |
|---|---|---|
| **RUT** (CL) | 8 col. dígito (0-9) + 1 col. DV (0-9 + **K**) | **DV módulo 11** ✅ ya implementado |
| **CPF** (BR) | 11 col. dígito + 2 col. DV | **2 DV módulo 11** (mismo principio que RUT) |
| **DNI** (PE) | 8 col. dígito | sin DV estándar (opcional 1 char verificador) |
| **DNI** (AR) | 7-8 col. dígito | sin DV |
| **CURP** (MX) | **18 alfanuméricos** → NO es grilla numérica simple | requiere grilla A-Z+0-9 o capturar como **imagen** + OCR aparte |
| **custom** | N columnas configurable | opcional |

**Nota CURP (México):** es el caso difícil (alfanumérico de 18). Opciones: (a)
grilla alfanumérica grande (mucho espacio), o (b) usar la **matrícula numérica**
de la institución en vez del CURP, o (c) capturar el CURP escrito como **imagen**
(como el nombre) sin leerlo por OMR. Decidir por mercado.

---

## 5. Zona de branding (logo / membrete)

- El logo, membrete y campos de identificación van en una **zona de cabecera reservada**
  (arriba), **fuera** de las zonas de lectura y sus márgenes blancos.
- Las **regiones OMR-críticas quedan fijas y protegidas** sin importar el branding:
  - 4 anclas de esquina sólidas
  - pista(s) de temporización
  - grilla de burbujas
  - grilla de ID/RUT
- Regla dura: **el branding NUNCA toca un fiducial ni su zona de silencio.** El
  generador debe validar que la imagen del logo cabe en la zona segura y recortarla/escalarla.

---

## 6. Implicaciones para el MOTOR (no es solo la hoja)

1. **Opciones configurables (3/4/5):** `gradeBubbles` ya itera `numOptions`; falta
   parametrizarlo de verdad y ajustar el render.
2. **Multi-columna:** hoy el registro por **pista de temporización** sirve para 1
   columna. Para varias columnas hace falta:
   - una pista de temporización **por columna**, o
   - **registro por bloques** con las anclas intermedias (las que quitamos) — esta vez
     **detectadas y usadas** (el trabajo que dejamos pendiente, aquí se justifica).
3. **Lectura de ID configurable:** generalizar `readRut` a `readIdField(config)` según
   el tipo (RUT/CPF/DNI…), con su validación de DV cuando aplique.
4. **QR de auto-identificación:** leer el QR del `quiz_id` → cargar la clave correcta
   (reemplaza el hack `?key=` en la URL).

---

## 7. Secuencia de mercados (recomendada)

1. **Chile** 🇨🇱 — mercado base, RUT hecho, formato PAES (máx 80, 5 opciones).
2. **México** 🇲🇽 — premio LATAM (mercado enorme). Requiere **3 opciones** + CURP.
3. **Perú** 🇵🇪 — fácil de seguir (español, DNI simple, 100q).
4. **Argentina** 🇦🇷 — sin examen nacional único → pitch de **aula** (no estándar).
5. **Brasil** 🇧🇷 — el grande. **Portugués** (localización) + ENEM 180q + CPF (DV gratis).
6. **USA** 🇺🇸 — el más grande pero **saturado** (ZipGrade, GradeCam, Scantron, Remark) + inglés. Último.

**Posicionamiento:** los competidores (ZipGrade y cía.) están en **inglés y formatos
US**. No existe un OMR-app **nativo LATAM** (español/portugués, RUT/DNI/CPF/CURP,
formatos PAES/EXANI/ENEM, precio local). Ese es el hueco.

---

## 8. Restricciones OMR que SIEMPRE se respetan

- Fiduciales (anclas, timing) en posiciones fijas con zona de silencio blanca.
- Burbujas con contorno gris claro (no contaminan el score).
- Aspecto de hoja vertical (~0.7) — el detector valida esto.
- Cualquier cambio de hoja toca **generador + motor + fixture** juntos (fuente única
  en `sheet_layout.ts`), con guardia de regresión (`npm run test:omr`).

---

## Fuentes
- ENEM (180): https://querobolsa.com.br/revista/quantas-questoes-tem-o-enem-2025-no-segundo-dia
- EXANI-II (168, 3 opciones): https://blog.unitips.mx/todo-lo-que-necesitas-saber-del-ceneval-exani-ii
- San Marcos Perú (100): https://www.infobae.com/peru/2025/02/28/examen-de-san-marcos-2025-ii-cantidad-de-preguntas-estructura-de-la-prueba-sistema-de-calificacion-y-todos-los-detalles/
- SAT (98) / ACT (131): https://testprepinsight.com/resources/how-many-questions-are-on-the-sat/
- PAES Chile (máx 80): https://demre.cl/publicaciones/2025/pruebas-oficiales-paes-regular-p2025
