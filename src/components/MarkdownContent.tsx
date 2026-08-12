function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-[#f3f4f6] px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (link && (link[2].startsWith("/") || link[2].startsWith("https://"))) return <a key={index} href={link[2]} className="font-semibold text-[#2563eb] underline">{link[1]}</a>;
    return <span key={index}>{part}</span>;
  });
}

export function MarkdownContent({ value }: { value: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    blocks.push(<ul key={`list-${blocks.length}`} className="ml-6 list-disc space-y-2">{list.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</ul>);
    list = [];
  };

  value.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*[-*]\s+/.test(line)) { list.push(line.replace(/^\s*[-*]\s+/, "")); return; }
    flushList();
    if (!line.trim()) return;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      blocks.push(<Tag key={index} className="pt-4 font-bold text-[#111827]">{renderInline(heading[2])}</Tag>);
    } else if (/^\d+\.\s+/.test(line)) {
      blocks.push(<p key={index} className="pl-2">{renderInline(line)}</p>);
    } else {
      blocks.push(<p key={index}>{renderInline(line)}</p>);
    }
  });
  flushList();
  return <div className="space-y-4">{blocks}</div>;
}
