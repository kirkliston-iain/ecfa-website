import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 60 }}>
      <div
        className="container"
        style={{
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 13,
          color: '#6B6555',
        }}
      >
        <span>Edinburgh Churches Football Association</span>
        <Link to="/admin">Admin</Link>
      </div>
    </footer>
  )
}
