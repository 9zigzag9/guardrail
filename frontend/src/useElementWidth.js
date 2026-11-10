import { useEffect, useState } from 'react'

// The current width of an element, updated when it is resized. Used by the charts drawn by hand,
// so they draw at real pixel size and their text stays readable on a phone instead of shrinking.
export default function useElementWidth(ref, fallback = 600) {
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    // Measure once straight away, then again whenever the element is resized.
    setWidth(Math.round(el.getBoundingClientRect().width))
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}
