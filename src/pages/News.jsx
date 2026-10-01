import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const PAGE_SIZE = 20

function displayDate(value) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function News() {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  async function loadPage(offset) {
    const { data, error: loadError } = await supabase.from('news_stories')
      .select('id, title, body, story_url, event_date, graphics, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (loadError) setError('News could not be loaded. Please try again later.')
    else {
      setStories((current) => offset === 0 ? data || [] : [...current, ...(data || [])])
      setHasMore((data || []).length === PAGE_SIZE)
    }
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    loadPage(0)
  }, [])

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 30, marginBottom: 22 }}>News</h1>
      {loading && <p>Loading news…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && stories.length === 0 && <p style={{ color: 'var(--muted)' }}>No news stories have been published yet.</p>}
      {stories.map((story) => (
        <article key={story.id} id={`story-${story.id}`} style={{ borderTop: '3px solid var(--brass)', padding: '18px 0 28px', marginBottom: 18 }}>
          <time dateTime={story.event_date} style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 700 }}>
            {displayDate(story.event_date)}
          </time>
          <h2 style={{ fontSize: 23, margin: '6px 0 12px', overflowWrap: 'anywhere' }}>{story.title}</h2>
          {story.body && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{story.body}</div>}
          {story.story_url && (
            <a href={story.story_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', color: 'var(--brass)', fontWeight: 700, textDecoration: 'underline', marginTop: 14 }}>
              Read the linked story
            </a>
          )}
          {Array.isArray(story.graphics) && story.graphics.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, marginTop: 18 }}>
              {story.graphics.map((graphic, index) => (
                <a key={graphic.path || index} href={graphic.url} target="_blank" rel="noopener noreferrer" aria-label={`Open graphic ${index + 1} for ${story.title}`}>
                  <img src={graphic.url} alt={`${story.title} graphic ${index + 1}`} loading="lazy" style={{ width: '100%', height: 'auto', maxHeight: 480, objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} />
                </a>
              ))}
            </div>
          )}
        </article>
      ))}
      {hasMore && !error && (
        <button type="button" disabled={loadingMore} onClick={() => { setLoadingMore(true); loadPage(stories.length) }} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {loadingMore ? 'Loading…' : 'Load more news'}
        </button>
      )}
    </div>
  )
}
