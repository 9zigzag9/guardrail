// highlighted_text marks suspicious parts as [[like this]].
// We split on the markers and render <mark> elements: no dangerouslySetInnerHTML,
// so React escapes everything and XSS is not possible here.
export default function HighlightedText({ text }) {
  const parts = String(text ?? '').split(/\[\[([\s\S]*?)\]\]/);
  // After split with one capture group, odd indexes are the highlighted parts.
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
      )}
    </>
  );
}
