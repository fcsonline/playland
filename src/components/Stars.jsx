/** Three-slot mastery display used on home cards and inside games. */
export default function Stars({ count = 0, max = 3, size = '1rem' }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? 'stars__on' : 'stars__off'}>
          ★
        </span>
      ))}
    </span>
  )
}
