"use client";

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-[#eef0f3] px-1 py-0.5 text-sm">{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (link && /^https?:\/\//.test(link[2])) return <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="text-[#2563eb] underline">{link[1]}</a>;
    return <span key={index}>{part}</span>;
  });
}

export function MarkdownPreview({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  function flushList() {
    if (!list.length) return;
    blocks.push(<ul key={`list-${blocks.length}`} className="ml-5 list-disc space-y-1">{list.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>);
    list = [];
  }

  lines.forEach((line, index) => {
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    flushList();
    if (!line.trim()) return;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      blocks.push(<Tag key={index} className="pt-3 font-bold text-[#111827]">{inline(heading[2])}</Tag>);
    } else {
      blocks.push(<p key={index}>{inline(line)}</p>);
    }
  });
  flushList();

  return <div className="space-y-3 text-sm leading-6 text-[#4b5563]">{blocks.length ? blocks : <p className="italic text-[#9ca3af]">La vista previa aparecerá aquí.</p>}</div>;
}
