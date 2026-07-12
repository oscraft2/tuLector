const INDEXNOW_KEY = "dcbf06ffa1014f4ea2f1775ab97f35c1";
const HOST = "tulector.app";

async function notifyIndexNow(urls: string[]) {
  const body = JSON.stringify({
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/IndexNowKey.txt`,
    urlList: urls,
  });

  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  console.log(`IndexNow ${res.status}: ${res.statusText}`);
  const text = await res.text();
  if (text) console.log(text);
}

const urls = process.argv.slice(2).filter(Boolean);
if (urls.length === 0) {
  console.error("Uso: npx tsx scripts/indexnow.ts <url1> <url2> ...");
  process.exit(1);
}

notifyIndexNow(urls.map((u) => (u.startsWith("http") ? u : `https://${HOST}/${u}`)));
