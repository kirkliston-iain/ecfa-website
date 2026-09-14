import { useState } from 'react'

const DOCUMENTS = [
  {
    title: 'ECFA League Handbook 2026/27',
    description: 'Official league rules, disciplinary procedures, competition formats and manager guidance for the 2026/27 season.',
    pdf: '/documents/ECFA-League-Handbook-2026-27.pdf',
    word: '/documents/ECFA-League-Handbook-2026-27.docx',
  },
]

export default function Documents() {
  const [viewing, setViewing] = useState(null)

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 820 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Documents</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 28 }}>
        View official ECFA documents online or download a copy.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        {DOCUMENTS.map((document) => (
          <article key={document.pdf} style={cardStyle}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{document.title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{document.description}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Available as PDF or Word</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setViewing(document)} style={outlineButtonStyle}>
                View PDF
              </button>
              <a href={document.pdf} download style={outlineButtonStyle}>
                Download PDF
              </a>
              <a href={document.word} download style={buttonStyle}>
                Download Word
              </a>
            </div>
          </article>
        ))}
      </div>

      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`View ${viewing.title}`}
          style={overlayStyle}
          onClick={() => setViewing(null)}
        >
          <div style={viewerStyle} onClick={(event) => event.stopPropagation()}>
            <div style={viewerHeaderStyle}>
              <strong>{viewing.title}</strong>
              <button onClick={() => setViewing(null)} style={closeButtonStyle} aria-label="Close document">
                ×
              </button>
            </div>
            <iframe
              src={viewing.pdf}
              title={viewing.title}
              style={{ width: '100%', flex: 1, border: 0, background: '#fff' }}
            />
            <div style={{ padding: 10, borderTop: '1px solid var(--line)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <a href={viewing.pdf} download style={outlineButtonStyle}>Download PDF</a>
              <a href={viewing.word} download style={buttonStyle}>Download Word</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const cardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: 16,
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: '#fff',
  flexWrap: 'wrap',
}

const buttonStyle = {
  display: 'inline-block',
  padding: '9px 14px',
  border: '1px solid var(--ink)',
  borderRadius: 6,
  background: 'var(--ink)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
}

const outlineButtonStyle = {
  ...buttonStyle,
  background: '#fff',
  color: 'var(--ink)',
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(0, 0, 0, 0.65)',
  padding: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const viewerStyle = {
  width: 'min(100%, 1000px)',
  height: 'min(92vh, 900px)',
  background: '#fff',
  borderRadius: 8,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const viewerHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 14px',
  borderBottom: '1px solid var(--line)',
}

const closeButtonStyle = {
  border: 0,
  background: 'transparent',
  fontSize: 28,
  lineHeight: 1,
  cursor: 'pointer',
}
