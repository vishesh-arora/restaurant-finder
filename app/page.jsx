'use client'

import { useState } from 'react'

const CATEGORIES = [
  { id: 'romantic', label: 'Romantic Dinner' },
  { id: 'family', label: 'Family Outing' },
  { id: 'birthday', label: 'Birthday Celebration' },
  { id: 'brunch', label: 'Brunch' },
  { id: 'drinks', label: 'Drinks with Friends' },
  { id: 'lunch', label: 'Lunch with Colleagues' },
]

const CUISINES = [
  { id: 'any', label: 'No Preference' },
  { id: 'north_indian', label: 'North Indian' },
  { id: 'south_indian', label: 'South Indian' },
  { id: 'continental', label: 'Continental' },
  { id: 'pan_asian', label: 'Pan Asian' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'italian', label: 'Italian' },
]

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedCuisine, setSelectedCuisine] = useState('any')
  const [freeText, setFreeText] = useState('')
  const [location, setLocation] = useState('')
  const [allResults, setAllResults] = useState([])
  const [displayed, setDisplayed] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!selectedCategory && !freeText) {
      setError('Please select an occasion or describe what you are looking for.')
      return
    }
    if (!location) {
      setError('Please enter a location.')
      return
    }

    setLoading(true)
    setError(null)
    setAllResults([])
    setDisplayed(3)
    setSearched(false)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          cuisine: selectedCuisine,
          freeText,
          location,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Something went wrong')

      setAllResults(data.restaurants)
      setSearched(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const visibleResults = allResults.slice(0, displayed)
  const hasMore = displayed < allResults.length

  const accent = '#B22222'
  const cardBg = '#1e1e1e'
  const borderColor = '#2a2a2a'

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2.5rem 1.25rem' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          fontSize: '3rem',
          fontWeight: '800',
          letterSpacing: '-1px',
          background: `linear-gradient(135deg, #ffffff 30%, ${accent})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem',
        }}>
          Restaurant Finder
        </div>
        <p style={{ color: '#aaa', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
          Discover the perfect place for every occasion
        </p>
        <div style={{
          width: '60px',
          height: '3px',
          backgroundColor: accent,
          margin: '1rem auto 0',
          borderRadius: '2px',
        }} />
      </div>

      {/* Category Picker */}
      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
          What's the occasion?
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                style={{
                  padding: '0.5rem 1.1rem',
                  borderRadius: '999px',
                  border: `2px solid ${isSelected ? accent : '#333'}`,
                  backgroundColor: isSelected ? accent : 'transparent',
                  color: isSelected ? '#fff' : '#ccc',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s',
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Cuisine Picker */}
      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
          Cuisine preference?
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {CUISINES.map((c) => {
            const isSelected = selectedCuisine === c.id
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCuisine(c.id)}
                style={{
                  padding: '0.5rem 1.1rem',
                  borderRadius: '999px',
                  border: `2px solid ${isSelected ? accent : '#333'}`,
                  backgroundColor: isSelected ? accent : 'transparent',
                  color: isSelected ? '#fff' : '#ccc',
                  fontWeight: '500',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Free Text */}
      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
          Tell us more (optional)
        </h2>
        <textarea
          placeholder="e.g. quiet rooftop with good wine and vegetarian options..."
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '0.85rem',
            borderRadius: '0.6rem',
            border: '1.5px solid #333',
            backgroundColor: cardBg,
            color: '#f0f0f0',
            fontSize: '0.95rem',
            resize: 'vertical',
            outline: 'none',
          }}
        />
      </section>

      {/* Location */}
      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
          Where?
        </h2>
        <input
          type="text"
          placeholder="e.g. Bandra, Mumbai or Koramangala, Bangalore"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{
            width: '100%',
            padding: '0.85rem',
            borderRadius: '0.6rem',
            border: '1.5px solid #333',
            backgroundColor: cardBg,
            color: '#f0f0f0',
            fontSize: '0.95rem',
            outline: 'none',
          }}
        />
      </section>

      {/* Search Button */}
      <button
        onClick={handleSearch}
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.9rem',
          backgroundColor: loading ? '#7a1111' : accent,
          color: '#fff',
          borderRadius: '0.6rem',
          border: 'none',
          fontSize: '1rem',
          fontWeight: '700',
          letterSpacing: '0.5px',
          marginBottom: '2rem',
          transition: 'background-color 0.2s',
        }}
      >
        {loading ? 'Finding restaurants...' : 'Find Restaurants'}
      </button>

      {/* Error */}
      {error && (
        <p style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '0.95rem' }}>{error}</p>
      )}

      {/* No Results */}
      {searched && allResults.length === 0 && (
        <p style={{ color: '#fff', fontSize: '1rem', textAlign: 'center', marginTop: '1rem' }}>
          No Results Found, Try a Different Location
        </p>
      )}

      {/* Results */}
      {visibleResults.length > 0 && (
        <section>
          <h2 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
            Top Picks
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {visibleResults.map((r, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                }}
              >
                {r.photoUrl && (
                  <img
                    src={r.photoUrl}
                    alt={r.name}
                    style={{
                      width: '100%',
                      height: '200px',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                )}

                <div style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontWeight: '700', fontSize: '1.05rem', color: '#fff' }}>{r.name}</h3>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      marginLeft: '0.5rem',
                      flexShrink: 0,
                    }}>
                      <span style={{
                        backgroundColor: '#2a1010',
                        color: '#ff9999',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        border: `1px solid ${accent}`,
                        whiteSpace: 'nowrap',
                      }}>
                        ⭐ {r.rating}
                      </span>
                      {r.userRatingCount && (
                        <span style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                          {r.userRatingCount.toLocaleString()} reviews
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ color: '#888', fontSize: '0.88rem', margin: '0.3rem 0' }}>{r.address}</p>
                  {r.reason && (
                    <p style={{
                      marginTop: '0.85rem',
                      fontSize: '0.9rem',
                      color: '#ccc',
                      lineHeight: '1.6',
                      borderTop: `1px solid ${borderColor}`,
                      paddingTop: '0.85rem',
                    }}>
                      {r.reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setDisplayed(displayed + 3)}
              style={{
                width: '100%',
                marginTop: '1.25rem',
                padding: '0.85rem',
                backgroundColor: 'transparent',
                color: accent,
                border: `2px solid ${accent}`,
                borderRadius: '0.6rem',
                fontSize: '0.95rem',
                fontWeight: '600',
              }}
            >
              Load More Options
            </button>
          )}
        </section>
      )}
    </main>
  )
}
