import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const INSTITUCIONES = [
  // Universidades Estatales
  { nombre: "Universidad de Chile", sigla: "UChile", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 7, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://uchile.cl" },
  { nombre: "Pontificia Universidad Catolica de Chile", sigla: "PUC", tipo: "Universidad Privada Tradicional", acreditada: true, anios_acreditacion: 7, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://uc.cl" },
  { nombre: "Universidad de Concepcion", sigla: "UdeC", tipo: "Universidad Privada Tradicional", acreditada: true, anios_acreditacion: 7, region: "Region del Biobio", comuna: "Concepcion", sitio_web: "https://udec.cl" },
  { nombre: "Pontificia Universidad Catolica de Valparaiso", sigla: "PUCV", tipo: "Universidad Privada Tradicional", acreditada: true, anios_acreditacion: 6, region: "Region de Valparaiso", comuna: "Valparaiso", sitio_web: "https://pucv.cl" },
  { nombre: "Universidad Tecnica Federico Santa Maria", sigla: "USM", tipo: "Universidad Privada Tradicional", acreditada: true, anios_acreditacion: 6, region: "Region de Valparaiso", comuna: "Valparaiso", sitio_web: "https://usm.cl" },
  { nombre: "Universidad de Santiago de Chile", sigla: "USACH", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 6, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://usach.cl" },
  { nombre: "Universidad Austral de Chile", sigla: "UACh", tipo: "Universidad Privada Tradicional", acreditada: true, anios_acreditacion: 6, region: "Region de Los Rios", comuna: "Valdivia", sitio_web: "https://uach.cl" },
  { nombre: "Universidad de La Frontera", sigla: "UFRO", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 5, region: "Region de La Araucania", comuna: "Temuco", sitio_web: "https://ufro.cl" },
  { nombre: "Universidad de Talca", sigla: "UTALCA", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 5, region: "Region del Maule", comuna: "Talca", sitio_web: "https://utalca.cl" },
  { nombre: "Universidad de Valparaiso", sigla: "UV", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 5, region: "Region de Valparaiso", comuna: "Valparaiso", sitio_web: "https://uv.cl" },
  { nombre: "Universidad de Tarapaca", sigla: "UTA", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 5, region: "Region de Arica y Parinacota", comuna: "Arica", sitio_web: "https://uta.cl" },
  { nombre: "Universidad de Antofagasta", sigla: "UA", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 5, region: "Region de Antofagasta", comuna: "Antofagasta", sitio_web: "https://uantof.cl" },
  { nombre: "Universidad de Atacama", sigla: "UDA", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 4, region: "Region de Atacama", comuna: "Copiapo", sitio_web: "https://uda.cl" },
  { nombre: "Universidad de La Serena", sigla: "ULS", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 5, region: "Region de Coquimbo", comuna: "La Serena", sitio_web: "https://userena.cl" },
  { nombre: "Universidad de Playa Ancha", sigla: "UPLA", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 4, region: "Region de Valparaiso", comuna: "Valparaiso", sitio_web: "https://upla.cl" },
  { nombre: "Universidad Metropolitana de Ciencias de la Educacion", sigla: "UMCE", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 5, region: "Region Metropolitana de Santiago", comuna: "Nunoa", sitio_web: "https://umce.cl" },
  { nombre: "Universidad Tecnologica Metropolitana", sigla: "UTEM", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 4, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://utem.cl" },
  { nombre: "Universidad del Bio-Bio", sigla: "UBB", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 5, region: "Region del Biobio", comuna: "Concepcion", sitio_web: "https://ubiobio.cl" },
  { nombre: "Universidad de Los Lagos", sigla: "ULagos", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 4, region: "Region de Los Lagos", comuna: "Osorno", sitio_web: "https://ulagos.cl" },
  { nombre: "Universidad de Magallanes", sigla: "UMAG", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 4, region: "Region de Magallanes y de la Antartica Chilena", comuna: "Punta Arenas", sitio_web: "https://umag.cl" },
  { nombre: "Universidad Arturo Prat", sigla: "UNAP", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 4, region: "Region de Tarapaca", comuna: "Iquique", sitio_web: "https://unap.cl" },
  { nombre: "Universidad de O'Higgins", sigla: "UOH", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 3, region: "Region del Libertador General Bernardo O'Higgins", comuna: "Rancagua", sitio_web: "https://uoh.cl" },
  { nombre: "Universidad de Aysen", sigla: "UAYSEN", tipo: "Universidad Estatal", acreditada: true, anios_acreditacion: 3, region: "Region de Aysen del General Carlos Ibanez del Campo", comuna: "Coyhaique", sitio_web: "https://uaysen.cl" },

  // Universidades Privadas
  { nombre: "Universidad Adolfo Ibanez", sigla: "UAI", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 5, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://uai.cl" },
  { nombre: "Universidad de Los Andes", sigla: "UANDES", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 6, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://uandes.cl" },
  { nombre: "Universidad Diego Portales", sigla: "UDP", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 5, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://udp.cl" },
  { nombre: "Universidad Alberto Hurtado", sigla: "UAH", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 5, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://uahurtado.cl" },
  { nombre: "Universidad Finis Terrae", sigla: "UFT", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 4, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://finisterrae.cl" },
  { nombre: "Universidad Mayor", sigla: "UMAYOR", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 4, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://umayor.cl" },
  { nombre: "Universidad Andres Bello", sigla: "UNAB", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 5, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://unab.cl" },
  { nombre: "Universidad San Sebastian", sigla: "USS", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 4, region: "Region del Biobio", comuna: "Concepcion", sitio_web: "https://uss.cl" },
  { nombre: "Universidad del Desarrollo", sigla: "UDD", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 5, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://udd.cl" },
  { nombre: "Universidad Autonoma de Chile", sigla: "UAUTONOMA", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 4, region: "Region del Maule", comuna: "Talca", sitio_web: "https://uautonoma.cl" },
  { nombre: "Universidad Central de Chile", sigla: "UCEN", tipo: "Universidad Privada", acreditada: true, anios_acreditacion: 4, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://ucentral.cl" },
  { nombre: "Universidad Catolica del Norte", sigla: "UCN", tipo: "Universidad Privada Tradicional", acreditada: true, anios_acreditacion: 6, region: "Region de Antofagasta", comuna: "Antofagasta", sitio_web: "https://ucn.cl" },
  { nombre: "Universidad Catolica del Maule", sigla: "UCM", tipo: "Universidad Privada Tradicional", acreditada: true, anios_acreditacion: 5, region: "Region del Maule", comuna: "Talca", sitio_web: "https://ucm.cl" },
  { nombre: "Universidad Catolica de Temuco", sigla: "UCT", tipo: "Universidad Privada Tradicional", acreditada: true, anios_acreditacion: 4, region: "Region de La Araucania", comuna: "Temuco", sitio_web: "https://uct.cl" },
  { nombre: "Universidad Catolica de la Santisima Concepcion", sigla: "UCSC", tipo: "Universidad Privada Tradicional", acreditada: true, anios_acreditacion: 4, region: "Region del Biobio", comuna: "Concepcion", sitio_web: "https://ucsc.cl" },

  // IP y CFT
  { nombre: "Instituto Profesional DUOC UC", sigla: "DUOC", tipo: "IP", acreditada: true, anios_acreditacion: 7, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://duoc.cl" },
  { nombre: "Instituto Profesional INACAP", sigla: "INACAP", tipo: "IP", acreditada: true, anios_acreditacion: 6, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://inacap.cl" },
  { nombre: "Instituto Profesional AIEP", sigla: "AIEP", tipo: "IP", acreditada: true, anios_acreditacion: 5, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://aiep.cl" },
  { nombre: "Instituto Profesional Santo Tomas", sigla: "IPST", tipo: "IP", acreditada: true, anios_acreditacion: 4, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://santotomas.cl" },
  { nombre: "Instituto Profesional de Chile", sigla: "IPCHILE", tipo: "IP", acreditada: true, anios_acreditacion: 4, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://ipchile.cl" },
  { nombre: "Centro de Formacion Tecnica CFT INACAP", sigla: "CFT INACAP", tipo: "CFT", acreditada: true, anios_acreditacion: 6, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://inacap.cl" },
  { nombre: "Centro de Formacion Tecnica Santo Tomas", sigla: "CFT ST", tipo: "CFT", acreditada: true, anios_acreditacion: 4, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://santotomas.cl" },
  { nombre: "Centro de Formacion Tecnica ENAC", sigla: "ENAC", tipo: "CFT", acreditada: true, anios_acreditacion: 4, region: "Region Metropolitana de Santiago", comuna: "Santiago", sitio_web: "https://enac.cl" },
];

async function main() {
  console.log(`\nImportando ${INSTITUCIONES.length} instituciones de educacion superior...`);

  const { error } = await supabaseAdmin.from("instituciones_superiores").upsert(INSTITUCIONES, {
    onConflict: "nombre",
    ignoreDuplicates: true,
  });

  if (error) {
    console.error("ERROR:", error.message);
  } else {
    console.log(`\n✓ ${INSTITUCIONES.length} instituciones importadas correctamente.`);
  }
}

main().catch(console.error);
