import { Link } from 'react-router-dom'

export default function AssistantOfficials({ fixture }) {
  const officials = [
    ['Assistant 1', fixture.assistant_1_name],
    ['Assistant 2', fixture.assistant_2_name],
  ].filter(([, name]) => name?.trim())

  if (!officials.length) return null
  return (
    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>
      {officials.map(([role, name]) => (
        <div key={role}>
          {role}:{' '}
          <Link to={`/referees?ref=${encodeURIComponent(name)}`}
            style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'var(--brass)', textUnderlineOffset: 3 }}>
            {name}
          </Link>
        </div>
      ))}
    </div>
  )
}
