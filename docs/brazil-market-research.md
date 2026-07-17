# Brazil Market Research Report for tuLector (Chilean EdTech SaaS)

> **Product**: tuLector — OMR bubble sheet scanning via phone camera. Generates printable answer sheets. Auto-grades multiple-choice tests using any smartphone camera. Delivers item analysis, gradebooks, and CSV exports.

> **Current codebase status**: Brazil is partially configured in `latam.ts` and `billing_catalog.ts`. Prices in BRL: pro=R$149, school=R$749. Gateway assigned = MercadoPago (but MP blocks non-Brazilian accounts). No `BR` entry in `LATAM_COUNTRIES` config. No Brazilian grading scale, CPF validation, or export format defined.

---

## 1. EDUCATION SYSTEM

### 1.1 Structure, Levels, and Ages

| Level | Portuguese Name | Years | Ages | Mandatory? |
|-------|----------------|-------|------|------------|
| Preschool | Educacao Infantil | — | 0-5 | No |
| Elementary I | Ensino Fundamental I | 1° ao 5° ano | 6-10 | Yes (6-14) |
| Elementary II | Ensino Fundamental II | 6° ao 9° ano | 11-14 | Yes (6-14) |
| High School | Ensino Medio | 1° ao 3° ano | 15-17 | Yes (until 17) |
| Higher Ed | Ensino Superior | 2-6 years | 18+ | No |

- **School year**: February to December (~200 days minimum, 800+ hours/year, set by LDB — Lei de Diretrizes e Bases).
- Brazil has ~47M students in basic education. 80%+ in public schools, 20% in private.
- Higher education: 2,600+ universities. ~8M students enrolled. Federal universities are free and most prestigious.

### 1.2 Grading Scale

Brazil uses a **0-10 scale** (standardized nationally):

| Score | Concept | Status |
|-------|---------|--------|
| 9.0-10.0 | Excelente (A) | Pass |
| 7.0-8.9 | Bom (B) | Pass |
| 5.0-6.9 | Regular (C) | Pass (barely) |
| 3.0-4.9 | Insuficiente (D) | Fail |
| 0.0-2.9 | Deficiente (E) | Fail |

- **Key config for latam.ts**: `gradeScale: { min: 0, max: 10 }, passingGrade: 5.0 (or 6.0 depending on the school), exigencia: 0.60`
- NOTE: Passing grade **varies per institution**. Most common is **6.0**, some use **5.0**, some **7.0**. Private schools often use 6.0, public schools historically 5.0. The government standard (MEC) recommends a **60%** minimum. **Recommend default 6.0 with 60% exigencia for tuLector.**

### 1.3 Grade Calculation

Brazilian schools calculate the **media aritmetica** (simple average of all tests in a period). No complex formula like Chile's 60% exigencia curve. Some schools use weighted averages. Most direct: `grade = (correct / total) * 10`.

---

## 2. STANDARDIZED TESTS (MOST IMPORTANT SECTION)

### 2.1 ENEM (Exame Nacional do Ensino Medio)

**The crown jewel of Brazilian education. Second-largest exam in the world after China's Gaokao.**

#### Stats
| Metric | Value |
|--------|-------|
| Candidates (peak 2016) | 8.6M registered, ~6.2M confirmed |
| Candidates (2025) | 4.81M confirmed (post-COVID recovery) |
| Candidates (2024) | 4.33M confirmed |
| Candidates (2014 peak) | 8.72M confirmed, 9.5M registered |
| Frequency | 1x/year (November, 2 consecutive Sundays) |
| Cost per student | ~R$46-160 depending on format |
| Digital format | Discontinued in 2023 (too expensive) |

#### Format
- **Day 1** (5h30): 90 questions (Languages + Humanities) + Essay (argumentative)
  - 45 Languages, Codes (Portuguese, Lit, English/Spanish, Arts, PE)
  - 45 Human Sciences (History, Geography, Philosophy, Sociology)
- **Day 2** (5h): 90 questions
  - 45 Natural Sciences (Biology, Physics, Chemistry)
  - 45 Mathematics
- **Total**: 180 multiple choice (A-E, 5 options) + 1 essay
- **Scoring**: Item Response Theory (IRT), NOT raw score. Scale varies per area. Essay: 0-1000.

#### Uses
1. **SISU** (Sistema de Selecao Unificada) — Unified admissions for federal universities. 2 editions/year.
2. **ProUni** — Scholarships at private universities (income-based).
3. **FIES** — Government student loans.
4. **Direct admission** — Many private and some public universities accept ENEM directly.
5. **Portugal** — Universities of Lisbon, Coimbra, Beira Interior accept ENEM scores.

#### Prep Ecosystem (ENORMOUS TARGET MARKET)
- **"Cursinhos pre-vestibular"**: Private prep courses. Industry worth billions of BRL.
- Major chains: **Anglo, Objetivo, ETAPA, Poliedro, Bernoulli, SAS, pH, COC**.
- Schools run **simulados ENEM** (mock ENEM exams) multiple times per year. Typically 3-5 mock exams per student per year.
- Online platforms: **Descomplica, Stoodi, Me Salva!, ProEnem, QG do ENEM**.
- **tuLector OPPORTUNITY**: Every cursinho and many high schools run bubble-sheet ENEM simulado. Manual grading is time-consuming. A teacher with 40-200+ students per mock exam would benefit enormously from phone-camera auto-grading.
- The answering sheet is a bubble grid. ENEM uses 5-option MC. The official answer sheet (cartao-resposta) is a grid where students fill bubbles with black pen. Perfect for OMR.
- **Volume potential**: 4-5M ENEM candidates/year, plus ~2-3M more doing simulado in cursinhos. Each doing 3-10 mock exams/year = potentially 20-50M answer sheets/year in need of grading.

### 2.2 Vestibular (Traditional University Entrance)

**Partially replaced by ENEM/SISU but still active at prestigious state universities.**

| University | Exam | Organizer | Format |
|-----------|------|-----------|--------|
| USP (Sao Paulo) | FUVEST | FUVEST Foundation | 2-phase: Phase 1 = 90 MC (A-E), Phase 2 = essay + written |
| UNICAMP | Comvest | COMVEST | 2-phase: Phase 1 = 72 MC (mostly), Phase 2 = written + specific skills |
| UNESP | VUNESP | VUNESP Foundation | 2-phase: Phase 1 = 90 MC (A-E), Phase 2 = essay + written |
| PUC-SP | Individual | PUC | 45 MC + written + essay (1 day) |
| Mackenzie | Individual | Mackenzie | 60 MC + essay |
| ITA/IME | Military Eng | Individual | Written math/physics/chem (STEM-heavy) |

- **Phase 1 is always multiple choice**, making it suitable for tuLector.
- Most top universities now use ENEM for majority of spots but reserve some for traditional vestibular.
- **UFMG** gives 10-15% bonus for public school students.
- **Racial quotas**: Federal Law 12.711/2012 requires 50% of federal university spots go to public school students, with racial sub-quotas.
- **Volume**: ~3-4M vestibular candidates annually (declining as ENEM grows).

### 2.3 SAEB / Prova Brasil (Sistema de Avaliacao da Educacao Basica)

- **Administered by**: INEP (same as ENEM).
- **Purpose**: Census-based national assessment of basic education quality.
- **Grades tested**: 2°, 5°, 9° ano do Ensino Fundamental and 3° ano do Ensino Medio.
- **Subjects**: Portuguese (reading) and Mathematics. Sometimes Sciences.
- **Format**: Multiple choice + some written responses. ~8M students tested every 2 years.
- **IDEB**: Index derived from SAEB scores + pass rates. Published per school.
- **School preparation**: YES. Schools prepare students specifically for SAEB/Prova Brasil. They run mock Prova Brasil tests. This is a secondary but real market for tuLector.
- **tuLector fit**: Medium. SAEB is administered by INEP centrally, but schools practice with mocks.

### 2.4 PISA (Programme for International Student Assessment)

- Brazil has participated since 2000. Results below OECD average in all 3 domains (reading, math, science).
- PISA 2022: Brazil scored 379 in math (OECD avg 472), 410 in reading (OECD avg 476), 403 in science (OECD avg 485).
- Not directly relevant for tuLector (no mock PISA market in Brazil schools).

### 2.5 OAB (Ordem dos Advogados do Brasil — Bar Exam)

- **Administered**: 3x/year (March, August, December) by FGV Projetos.
- **Format**: 2 phases:
  - **Phase 1**: 80 multiple choice questions (A-D, 4 options), must score 50%+ (40/80) to pass to Phase 2.
  - **Phase 2**: Written practical-professional exam + essay (specific to the area of law).
- **Volume**: ~150,000-200,000 candidates per edition. ~1.3M registered lawyers total.
- **Prep market**: Huge. Cursinhos for OAB (CEJAS, Damasio, LFG, MeuCurso, etc.). These run mock OAB exams with bubble sheets.
- **tuLector fit**: Strong secondary market. OAB Phase 1 is pure multiple choice with 4 options. Cursinhos need to grade hundreds of mock answer sheets.
- **NOTE**: OAB uses 4 options (A-D), not 5 like ENEM. tuLector's current system supports any option count via config.

### 2.6 Encceja (Exame Nacional para Certificacao de Competencias de Jovens e Adultos)

- **Purpose**: High school equivalency diploma for adults (equivalent to USA GED or Chile's examenes libres).
- **Volume**: ~600,000-1,000,000 candidates/year.
- **Format**: 4 tests (multiple choice). 30 questions each.
- **Minor market** for tuLector. Prep exists but smaller than ENEM.

### 2.7 Concurso Publico (Civil Service Exam)

- **Massive market**. Brazil's public sector entrance exams.
- **Volume**: Millions of candidates annually. Federal, state, municipal levels.
- **Format**: Varies. Almost all include a multiple choice phase (typically A-E, some A-D). Phase 2 usually written/discursive.
- **Major organizers**: CESPE/CEBRASPE (UnB), CESGRANRIO, FGV, FCC, VUNESP.
- **Prep market**: Staggering. Thousands of private "cursinhos para concursos". Every single one runs mock exams with bubble sheets.
- **tuLector fit**: Excellent. Concurso prep courses need rapid grading of mock MC answer sheets. High volume, year-round demand (not seasonal like ENEM).
- **Ethical note**: tuLector cannot handle actual exam security but can serve the prep/mock ecosystem.

---

## 3. UNIVERSITY ENTRANCE ECOSYSTEM

### 3.1 Pathways Summary

| Pathway | System | Who uses it | Volume |
|---------|--------|-------------|--------|
| ENEM + SISU | Federal | Federal + some state universities | ~3-4M students enter via this |
| Vestibular | Per university | USP, UNICAMP, UNESP, some other state/private | Declining but ~1M+ |
| ENEM direct | Score submission | Many private universities | Growing |
| ProUni | Scholarships | Low-income at private unis | ~300K/year |
| FIES | Loans | Mid-income at private unis | ~100K/year |

### 3.2 Total University Entrants

- ~3.5-4M students enter higher education per year in Brazil (public + private combined).
- Most from ENEM/SISU funnel.

### 3.3 "Cursinhos" Market

- **Definition**: Preparatory courses (cram schools) for vestibular/ENEM/concurso.
- **Size**: 5,000+ institutions. Multi-billion BRL market.
- **Structure**: Year-long (~9 months), semi-intensive (~6 months), intensive (~3 months).
- **Mock exam frequency**: Typically 1-2 mock exams per month during the year. Each with 50-180 questions.
- **Grading**: Many still use manual grading or in-house software. Phone-camera OMR is an immediate upgrade path.
- **tuLector value prop**: Save cursinhos hours of teacher time per mock exam. Instant item analysis (difficulty index, distractor analysis) is gold for cursinho pedagogy.

---

## 4. STUDENT ID

### 4.1 CPF (Cadastro de Pessoas Fisicas)

- **Format**: `xxx.xxx.xxx-xx` — 11 digits. Last 2 are check digits (mod 11 algorithm).
- **Universality**: Every Brazilian citizen has a CPF. Used as universal identifier since 2023 law (Lei 14.534/2023) making it the single national ID number.
- **Foreign residents**: Can also obtain CPF.
- **Children**: Can have CPF from birth. Mandatory for school enrollment.
- **tuLector**: CPF is the definitive student ID for Brazil. Validate format with check digit algorithm.
- **Regex**: `/^\d{3}\.\d{3}\.\d{3}-\d{2}$/`
- **Check digit validation**: Standard mod-11 algorithm (need to implement in `latam.ts`).

### 4.2 RA (Registro do Aluno)

- Schools assign their own internal enrollment number (RA), typically 6-10 digits.
- Not standardized nationally. Internal to each school's management system.
- **tuLector**: Support both CPF and custom RA. CPF is the standard external ID, RA is internal school ID.

---

## 5. PAYMENT ECOSYSTEM (CRITICAL)

### 5.1 PIX (Instant Payment by Central Bank of Brazil)

**This is THE payment method for Brazil. Non-negotiable.**

| Metric | Value |
|--------|-------|
| Users | 200M+ (175M individuals, 25M businesses) — >80% of population |
| Transaction volume (Q1 2026) | ~R$3.4 trillion/month (~US$660B) |
| Market share | 47% of all financial transactions in Brazil |
| Approval rating | 92% of Brazilians approve |
| Adult usage | 93% of Brazilian adults use it, 62% as primary method |
| Speed | Instant, 24/7/365 |
| Cost for individuals | **Free** |
| Cost for businesses | ~0.33% per transaction (vs 1.13% debit, 2.34% credit) |
| Max per transaction | No universal limit (bank-specific, typically R$1,000-5,000 overnight) |

#### PIX for Foreign Companies
- **Can a foreign (Chilean) company accept PIX?** YES, but through intermediaries:
  - Direct PIX requires a Brazilian bank account + CPF/CNPJ.
  - **dLocal**: Supports PIX for cross-border merchants. Chilean company can integrate.
  - **EBANX**: Same. Handles PIX + cross-border settlement.
  - **PagSeguro / PagBank**: Cross-border PIX.
  - **MercadoPago**: Supports PIX but requires a Brazilian entity/CNPJ.
  - **Stripe Brazil**: Supports PIX now. But requires a Brazilian entity.

- **PIX QR Code** (static and dynamic) is the standard way to present PIX in checkout.
- **PIX Cobranca**: Recurring PIX is coming (BCB announced). Currently PIX is per-transaction.
- **PIX Parcelado**: ANNOUNCED by BCB for 2025/2026. Will enable installment PIX. Game-changer for SaaS.

### 5.2 Credit Cards

- **Installment culture (parcelado)**: Deeply ingrained. Brazilians expect to pay in installments.
- **Common options**: 1x-12x (sometimes up to 18x).
- **"Sem juros" (interest-free)**: Merchant subsidizes the installments. Very common.
- **Fees**: Standard MDR (Merchant Discount Rate) ~2-5% per transaction, higher for installment plans. Interchange varies.
- **International cards**: Visa/Mastercard dominant. Amex less common. Elo (local network) significant.
- **Cross-border**: Foreign merchants pay higher fees + IOOF tax (6.38%) on credit card international payments.

### 5.3 Boleto Bancario

- **Legacy but still used**: ~20% of e-commerce payments. Declining as PIX grows.
- **Fees**: R$3-5 per boleto processing fee.
- **Settlement**: 1-3 business days.
- **tuLector relevance**: Should offer as fallback but not primary. PIX + credit card cover 85%+.

### 5.4 MercadoPago Brazil

- **Market position**: #1 or #2 digital wallet in Brazil (with PicPay).
- **Capabilities**: Checkout Pro (redirect), Checkout Transparente (API), Checkout Bricks (components), Subscription plans.
- **Payment methods via MP**: PIX, credit/debit cards (all bands), boleto, Mercado Credito (buy now pay later), Mercado Pago wallet balance.
- **Fees for online**: ~3.99% for credit (1x), higher for installments. ~0.99% for PIX. Boleto: R$3.99 fixed.
- **Subscription API**: EXISTS. MercadoPago has a `/preapproval` API for recurring payments.
- **Documentation**: https://www.mercadopago.com.br/developers/en/docs
- **CRITICAL BLOCKER**: **MercadoPago Brazil requires a Brazilian CNPJ** (corporate tax ID) to open a merchant account. A Chilean company CANNOT directly register. This is why MP is "blocked" in the codebase.

### 5.5 Stripe Brazil

- **Availability**: YES, Stripe operates in Brazil (entity: Stripe Brasil Solucoes de Pagamento Ltda., CNPJ 22.121.209/0001-46).
- **Method**: Credenciadora (acquirer) under BACEN regulation.
- **Supported methods**: Credit/debit cards (Visa, Mastercard, Elo, Amex, Hipercard), PIX, Boleto.
- **Fees**: Standard Stripe pricing for Brazil. ~3.99% + R$1.50 for domestic cards.
- **Cross-border**: A Chilean company CAN integrate Stripe Brazil IF they use Stripe Connect or create a Brazilian sub-entity. Stripe's cross-border capabilities for LATAM are limited vs dLocal/EBANX.
- **tuLector feasibility**: Stripe could work IF tuLector creates a Brazilian Stripe account. Requires CNPJ. If tuLector operates as a global merchant via Stripe's existing infrastructure, Brazilian customers may pay via international card (with higher fees + IOOF).

### 5.6 dLocal (Cross-Border Specialist)

- **Founded**: Uruguay, 2016. Public company (NASDAQ: DLO).
- **Specialty**: Cross-border payments for global merchants selling in LATAM/Africa/Asia.
- **Brazil support**: PIX, Boleto, credit cards (local processing), installment plans.
- **Model**: dLocal acts as the local merchant of record. Chilean company collects in USD/CLP, dLocal handles local settlement.
- **Fees**: Negotiated, typically 3-6% depending on volume and payment method.
- **Integration**: REST API. Webhooks. Drop-in checkout available.
- **No local entity required**: This is the key advantage.
- **Website**: https://dlocal.com

### 5.7 EBANX (Cross-Border Specialist)

- **Founded**: Curitiba, Brazil, 2012. Now global.
- **Specialty**: Cross-border payments INTO Brazil and LATAM.
- **Brazil support**: PIX, Boleto, credit cards with installments, local wallets.
- **Model**: Same as dLocal — merchant of record model. No local entity needed.
- **Clients**: Spotify, Airbnb, AliExpress, Uber in Brazil.
- **Integration**: REST API, SDK, hosted checkout.
- **Website**: https://www.ebanx.com

### 5.8 PagSeguro / PagBank (UOL)

- Local Brazilian acquirer. Requires Brazilian entity (CNPJ).
- Offers PIX, cards, boleto, subscriptions.
- Not ideal for cross-border.

### 5.9 PicPay

- Major Brazilian digital wallet (~60M users). Growing e-commerce presence.
- Less developer-friendly than MercadoPago.

### 5.10 Tax Implications for Chilean Company Charging BRL

| Aspect | Detail |
|--------|--------|
| **IOOF (Imposto sobre Operacoes Financeiras)** | 6.38% tax on foreign exchange transactions (credit card cross-border). Applies if charging Brazilian cards from Chile. |
| **Withholding tax** | Brazil may withhold 15-25% on payments to foreign entities for services. Software/SaaS may qualify for reduced rates under double-taxation treaties. |
| **Chile-Brazil tax treaty** | Exists (2001). May reduce withholding. Consult tax advisor. |
| **ISS (Municipal Service Tax)** | 2-5% if you have a Brazilian entity. Not applicable if cross-border. |
| **PIS/COFINS** | 9.25% cumulative for services. Only if Brazilian entity. |
| **ICMS** | State VAT. Not typically for SaaS (varies by state, evolving). |

### 5.11 Recommended Payment Strategy for tuLector Brazil

**Phase 1 (fastest, no local entity):**
- Partner with **dLocal** or **EBANX** for cross-border PIX + credit cards with installments.
- Offer: PIX (QR code → instant), credit cards (1x-12x), boleto (fallback).
- tuLector bills in BRL, settles in CLP or USD.
- Tax: IOOF 6.38% on card payments absorbed or passed to customer. PIX has no IOOF.
- Cost: 3-6% total depending on volume.

**Phase 2 (with local entity or Stripe expansion):**
- If Stripe opens cross-border LATAM support, use Stripe Brazil.
- If tuLector opens a Brazilian entity (CNPJ), can use MercadoPago with lower fees (~3.99%).

---

## 6. CURRENT STATE IN TULECTOR CODEBASE

### 6.1 What Exists

| Component | File | Status |
|-----------|------|--------|
| Billing country `BR` | `billing_catalog.ts:35` | DEFINED. BRL currency. Plan prices: pro=R$149, school=R$749 |
| Gateway for BR | `billing_catalog.ts:62` | Set to `mercadopago` |
| LATAM country config BR | `latam.ts:16-63` | **MISSING**. No `BR` entry in `LATAM_COUNTRIES` |
| Grading config BR | `latam.ts` | **MISSING** |
| CPF validation | `latam.ts` | **MISSING** |
| Export formats BR | `latam.ts:241` | **MISSING**. No `inep` or `sisu` format |
| Eval systems BR | `20260525000002_latam_eval.sql` | **MISSING**. No ENEM, SAEB in evaluation_systems |
| Curriculum taxonomy BR | `migrations` | **MISSING** |
| Performance levels ENEM | `migrations` | **MISSING** |

### 6.2 What Needs to Be Added for MVP

1. **`latam.ts`**: Add `BR` to `LATAM_COUNTRIES`:
   ```ts
   BR: {
     code: "BR", name: "Brasil",
     gradeScale: { min: 0, max: 10 },
     passingGrade: 6.0,
     exigencia: 0.60,
     idType: "cpf",
     idFormat: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
   }
   ```

2. **CPF validation function**: Implement modulo-11 check digit algorithm (standard for CPF, different from RUT).

3. **Grade calculation**: Brazil uses simple direct proportion: `grade = (correct/total) * 10`. No "exigencia" curve like Chile. Add a `BR` case that uses linear mapping. Option to toggle between Chilean curve vs linear grade.

4. **Billing gateway**: Replace `mercadopago` with `dlocal` or `ebanx` for Brazil (or add as separate option). Update `billing_catalog.ts` gateway mapping.

5. **Export formats**: Add `inep_enem` and `sisu` CSV formats.

6. **Database**: Add `BR` country row to `countries` table. Add evaluation systems for ENEM and SAEB. Add curriculum taxonomy (ENEM's 5 areas, 30 competencies).

---

## 7. KEY OPPORTUNITY SUMMARY

### 7.1 Primary Market: ENEM Prep (Cursinhos)

- **Volume**: 3-5M students in ENEM prep per year. 3-10 mock exams each. 50-200 students per cursinho class.
- **Pain point**: Manual grading of ENEM simulado bubble sheets wastes hours weekly per teacher.
- **tuLector solution**: Phone camera OMR + instant item analysis. Value: speed, item difficulty data, distractor analysis.
- **Willingness to pay**: Cursinhos charge R$500-R$3,000/month per student. R$149/year (pro) or R$749/year (school) is negligible vs their revenue.

### 7.2 Secondary Markets

| Market | Volume | Fit |
|--------|--------|-----|
| High schools (Ensino Medio) | ~8M students | Internal tests, ENEM prep |
| Cursinhos para concursos | Millions of candidates | MC exam grading |
| OAB prep | ~500K candidates/year | Phase 1 grading |
| SAEB prep | ~8M tested per cycle | Mock SAEB grading |
| Higher education (universities) | ~8M students | Internal assessments |

### 7.3 Revenue Model Recommendation

- Keep prices: **pro=R$149/year** (2,000 scans), **school=R$749/year** (10,000 scans).
- These are extremely competitive vs CNPJ costs. Brazilian schools spend R$5,000-50,000/year on assessment software.
- Consider a **"cursinho" mid-tier** at R$399/year (5,000 scans) for the sweet spot between pro and school.
- Freemium: 100 free scans/month to hook teachers.

---
Generated: July 2026
Sources: Wikipedia (ENEM, PIX, Education in Brazil, CPF, OAB, Vestibular, Civil Service), Inep.gov.br, BCB.gov.br, MercadoPago Developers, Stripe BR, dLocal, EBANX, Brazilian Finance.
