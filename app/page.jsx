'use client'

import { useState } from 'react'

const CATEGORIES = [
  { id: 'romantic', label: '💑 Romantic Dinner' },
  { id: 'business', label: '💼 Business Lunch' },
  { id: 'family', label: '👨‍👩‍👧 Family Outing' },
  { id: 'birthday', label: '🎂 Birthday Celebration' },
  { id: 'casual', label: '😊 Casual Hangout' },
  { id: 'solo', label: '🧘 Solo Dining' },
  { id: 'brunch', label: '🥂 Brunch' },
  { id: 'budget', label: '💰 Budget Meal' },
]

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [freeText, setFreeText] = useState('')
  const [location, setLocation] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState('')

  const handleSearch = async () => {
    if (!selectedCategory && !freeText) {
      setError('Please select a category or describe what you are looking for.')
      return
    }
    if (!location) {
      setError('Please enter a location.')
      return
    }

    setLoading(true)
    setError(null)
    setResults([])
    setSummary('')

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory, freeText, location }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Something went wrong')

      setResults(data.restaurants)
      setSummary(data.summary)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
        🍽️ Restaurant Finder
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Find the perfect restaurant for any occasion
      </p>

      {/* Category Picker */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
          What's the occasion?
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                border: '2px solid',
                borderColor: selectedCategory === cat.id ? '#111827' : '#e5e7eb',
                backgroundColor: selectedCategory === cat.id ? '#111827' : '#fff',
                color: selectedCategory === cat.id ? '#fff' : '#111827',
                fontWeight: '500',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Free Text */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
          Tell us more (optional)
        </h2>
        <textarea
          placeholder="e.g. looking for a quiet rooftop with good wine and vegetarian options..."
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '2px solid #e5e7eb',
            fontSize: '0.95rem',
            resize: 'vertical',
          }}
        />
      </section>

      {/* Location */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
          Where?
        </h2>
        <input
          type="text"
          placeholder="e.g. Bandra, Mumbai or Koramangala, Bangalore"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '2px solid #e5e7eb',
            fontSize: '0.95rem',
          }}
        />
      </section>

      {/* Search Button */}
      <button
        onClick={handleSearch}
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.85rem',
          backgroundColor: '#111827',
          color: '#fff',
          borderRadius: '0.5rem',
          border: 'none',
          fontSize: '1rem',
          fontWeight: '600',
          marginBottom: '2rem',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Finding restaurants...' : 'Find Restaurants'}
      </button>

      {/* Error */}
      {error && (
        <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
      )}

      {/* Summary */}
      {summary && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#166534',
          fontSize: '0.95rem',
          lineHeight: '1.6',
        }}>
          {summary}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
            Top Picks
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontWeight: '600', fontSize: '1.05rem' }}>{r.name}</h3>
                  <span style={{
                    backgroundColor: '#fef9c3',
                    color: '#854d0e',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    marginLeft: '0.5rem',
                  }}>
                    ⭐ {r.rating}
                  </span>
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.25rem 0' }}>{r.address}</p>
                {r.priceLevel && (
                  <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    {'💰'.repeat(r.priceLevel)}
                  </p>
                )}
                {r.reason && (
                  <p style={{
                    marginTop: '0.75rem',
                    fontSize: '0.9rem',
                    color: '#374151',
                    lineHeight: '1.5',
                    borderTop: '1px solid #f3f4f6',
                    paddingTop: '0.75rem',
                  }}>
                    {r.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
