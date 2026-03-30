import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORY_CONFIG = {
  romantic: {
    types: ['restaurant'],
    context: 'fine dining, intimate, quiet, candlelit, upscale, great for a date. Exclude busy casual chains, loud popular joints, or mass market restaurants.',
  },
  family: {
    types: ['restaurant'],
    context: 'family-friendly, comfortable, casual, suitable for kids and all ages, spacious seating.',
  },
  birthday: {
    types: ['restaurant'],
    context: 'celebratory, lively, great for groups, festive atmosphere, good ambiance.',
  },
  brunch: {
    types: ['restaurant', 'cafe', 'breakfast_restaurant'],
    context: 'serves brunch menu — eggs, pancakes, waffles, sandwiches, juices, coffee. NOT traditional South Indian breakfast places like idli dosa filter coffee joints unless user asked for South Indian.',
  },
  drinks: {
    types: ['bar', 'pub', 'night_club', 'wine_bar'],
    context: 'bar, pub, lounge, brewery, serves alcohol and cocktails. Exclude cafes and coffee shops entirely.',
  },
  lunch: {
    types: ['restaurant'],
    context: 'professional setting, quiet enough for conversation, suitable for business lunch.',
  },
}

const CUISINE_CONTEXT = {
  any: '',
  north_indian: 'North Indian cuisine — tandoor, curries, biryani, naan',
  south_indian: 'South Indian cuisine — dosa, idli, sambhar, rice dishes',
  continental: 'Continental/Western cuisine — pasta, grills, salads, steaks',
  pan_asian: 'Pan Asian cuisine — sushi, Thai, Vietnamese, Korean, Japanese',
  chinese: 'Chinese cuisine — noodles, dim sum, stir fry',
  italian: 'Italian cuisine — pizza, pasta, risotto',
}

async function fetchNearby(types, lat, lng, radius) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.editorialSummary,places.photos,places.types',
    },
    body: JSON.stringify({
      includedTypes: types,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius,
        },
      },
    }),
  })
  const data = await res.json()
  return data.places || []
}

export async function POST(request) {
  try {
    const { category, cuisine, freeText, location } = await request.json()

    console.log('SEARCH:', JSON.stringify({ category, cuisine, freeText, location, timestamp: new Date().toISOString() }))

    // Step 1: Geocode the location
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
    const geocodeRes = await fetch(geocodeUrl)
    const geocodeData = await geocodeRes.json()

    if (!geocodeData.results || geocodeData.results.length === 0) {
      return Response.json({ error: 'Location not found. Please try a different area.' }, { status: 400 })
    }

    const { lat, lng } = geocodeData.results[0].geometry.location
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.romantic

    // Step 2: Fetch nearby places — try 1500m first, expand to 3000m if needed
    let places = await fetchNearby(config.types, lat, lng, 1500)
    if (places.length < 5) {
      places = await fetchNearby(config.types, lat, lng, 3000)
    }

    if (places.length === 0) {
      return Response.json({ error: 'No results found in this area. Try a different location.' }, { status: 400 })
    }

    // Step 3: Filter by minimum rating 4.0
    let restaurantList = places
      .filter(p => (p.rating || 0) >= 4.0)
      .map((p, i) => ({
        index: i + 1,
        name: p.displayName?.text || 'Unknown',
        address: p.formattedAddress || '',
        rating: p.rating || 'No rating',
        userRatingCount: p.userRatingCount || null,
        priceLevel: p.priceLevel || null,
        description: p.editorialSummary?.text || '',
        types: p.types || [],
        photoName: p.photos?.[0]?.name || null,
      }))

    // If rating filter is too strict, relax to 3.8
    if (restaurantList.length < 3) {
      restaurantList = places
        .filter(p => (p.rating || 0) >= 3.8)
        .map((p, i) => ({
          index: i + 1,
          name: p.displayName?.text || 'Unknown',
          address: p.formattedAddress || '',
          rating: p.rating || 'No rating',
          userRatingCount: p.userRatingCount || null,
          priceLevel: p.priceLevel || null,
          description: p.editorialSummary?.text || '',
          types: p.types || [],
          photoName: p.photos?.[0]?.name || null,
        }))
    }

    if (restaurantList.length === 0) {
      return Response.json({ error: 'No highly rated results found. Try a different location or occasion.' }, { status: 400 })
    }

    // Step 4: Ask Claude to rank and explain
    const cuisineContext = CUISINE_CONTEXT[cuisine] || ''
    const cuisineInstruction = cuisine && cuisine !== 'any'
      ? `The user specifically wants ${cuisineContext}. Only recommend places that serve this cuisine. Exclude any place that does not match.`
      : 'The user has no cuisine preference.'

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are a restaurant recommendation expert. 

Occasion: ${category} — ${config.context}
Cuisine instruction: ${cuisineInstruction}
Extra notes from user: ${freeText || 'none'}
Location: ${location}

Here are candidate restaurants:

${JSON.stringify(restaurantList, null, 2)}

Select the top 6 most suitable restaurants that genuinely match the occasion and cuisine. Use your knowledge of restaurant types and vibes to make smart choices — do not just pick by rating alone. For each, explain in 1-2 sentences why it suits the user.

IMPORTANT: Respond with ONLY raw valid JSON. No markdown. No backticks. No trailing commas. Just JSON starting with { and ending with }.

{
  "restaurants": [
    {
      "index": 1,
      "name": "Place Name",
      "address": "Full address",
      "rating": 4.5,
      "reason": "Why this suits the occasion"
    }
  ]
}`,
        },
      ],
    })

    // Step 5: Parse Claude response
    const raw = message.content[0].text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response from AI')

    const cleaned = jsonMatch[0]
      .replace(/,\s*\]/g, ']')
      .replace(/,\s*\}/g, '}')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')

    const parsed = JSON.parse(cleaned)

    // Step 6: Attach photos and review counts
    const photoBaseUrl = 'https://places.googleapis.com/v1/'
    const results = await Promise.all(
      parsed.restaurants.map(async (r) => {
        const original = restaurantList.find(p => p.name === r.name)
        let photoUrl = null
        if (original?.photoName) {
          photoUrl = `${photoBaseUrl}${original.photoName}/media?maxHeightPx=400&maxWidthPx=800&key=${process.env.GOOGLE_PLACES_API_KEY}&skipHttpRedirect=false`
        }
        return { ...r, photoUrl, userRatingCount: original?.userRatingCount || null }
      })
    )

    return Response.json({ restaurants: results })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
