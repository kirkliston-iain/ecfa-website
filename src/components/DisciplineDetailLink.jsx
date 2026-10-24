import { Link, useNavigate } from 'react-router-dom'

// Capture the overview position when clicked, after the visitor has scrolled.
export default function DisciplineDetailLink({ to, teamFilter, className, children }) {
  const navigate = useNavigate()
  return (
    <Link to={to} className={className} onClick={(event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigate(to, { state: { disciplineReturn: { teamFilter, scrollY: window.scrollY } } })
    }}>
      {children}
    </Link>
  )
}
