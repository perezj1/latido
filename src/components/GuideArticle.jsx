function Emphasis({ text }) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  )
}

export function formatGuideReviewDate(value) {
  return new Intl.DateTimeFormat('es', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
}

export default function GuideArticle({ guide }) {
  return (
    <article className="latido-guide-article" aria-label={guide.title}>
      <div className="latido-guide-review">
        <span>Revisada el <time dateTime={guide.reviewedAt}>{formatGuideReviewDate(guide.reviewedAt)}</time></span>
        <span>Fuentes oficiales y sectoriales</span>
      </div>
      <p className="latido-guide-intro">{guide.summary}</p>
      {guide.sections.map((section, index) => (
        <section key={section.heading} className="latido-guide-section">
          <h2><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.heading}</h2>
          {section.paragraphs.map(text => <p key={text}><Emphasis text={text} /></p>)}
          {section.bullets.length > 0 && <ul>{section.bullets.map(text => <li key={text}><Emphasis text={text} /></li>)}</ul>}
          {section.note && <aside className="latido-guide-note"><Emphasis text={section.note} /></aside>}
        </section>
      ))}
      <section className="latido-guide-sources" aria-label="Fuentes de esta guía">
        <h2>Fuentes y consultas</h2>
        <p>Consulta los requisitos y formularios vigentes antes de iniciar el trámite. Las reglas locales deben comprobarse en tu cantón.</p>
        <ul>{guide.sources.map(source => (
          <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<span aria-hidden="true"> ↗</span></a></li>
        ))}</ul>
      </section>
    </article>
  )
}
