/**
 * Bloque de ID nacional del motor OMR, por pais. Une el perfil de producto
 * (CountryProfile, ver country_profiles.ts) con la geometria/checksum del
 * motor (src/tulector/sheet_layout.ts + omr.ts, ya generalizados a 7 paises).
 * Unico lugar donde "pais" se traduce a "que bloque de burbujas imprimir/leer"
 * — asi /sheet, /scan y sheet_generator.ts comparten la misma fuente de verdad.
 *
 * Separado de country_profiles.ts a proposito (auditoria jul 15 2026): ese
 * archivo lo importan supabase_server.ts (server, en TODA la app) y
 * AnswerKeyEditor.tsx (cliente) que solo necesitan resolveCountryProfile, no
 * el motor OMR completo (~1400 lineas) que este mapeo arrastra.
 */
import { resolveCountryProfile, type CountryCode } from "@/lib/country_profiles";
import {
  ID_BLOCK_CL, ID_BLOCK_AR, ID_BLOCK_BR, ID_BLOCK_PE, ID_BLOCK_CO, ID_BLOCK_EC, ID_BLOCK_UY,
  type IdBlockConfig,
} from "@/lib/sheet_layout";
import {
  ID_READ_CL, ID_READ_AR, ID_READ_BR, ID_READ_PE, ID_READ_CO, ID_READ_EC, ID_READ_UY,
  type IdReadConfig,
} from "@/lib/omr";

const ID_BLOCK_BY_COUNTRY: Record<CountryCode, IdBlockConfig> = {
  CL: ID_BLOCK_CL, AR: ID_BLOCK_AR, BR: ID_BLOCK_BR, PE: ID_BLOCK_PE, CO: ID_BLOCK_CO, EC: ID_BLOCK_EC, UY: ID_BLOCK_UY,
};

const ID_READ_BY_COUNTRY: Record<CountryCode, IdReadConfig> = {
  CL: ID_READ_CL, AR: ID_READ_AR, BR: ID_READ_BR, PE: ID_READ_PE, CO: ID_READ_CO, EC: ID_READ_EC, UY: ID_READ_UY,
};

export function resolveIdBlock(value?: string | null): IdBlockConfig {
  return ID_BLOCK_BY_COUNTRY[resolveCountryProfile(value).code];
}

export function resolveIdReadConfig(value?: string | null): IdReadConfig {
  return ID_READ_BY_COUNTRY[resolveCountryProfile(value).code];
}
