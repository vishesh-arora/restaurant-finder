import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORY_CONTEXT = {
  romantic: 'intimate, quiet, candlelit, fine dining, date night, upscale ambiance',
  family: 'family-friendly, comfortable, casual, suitable for kids and all ages',
  birthday: 'celebratory, lively, good ambiance, great for groups, festive atmosphere',
  brunch: 'brunch menu, eggs, pancakes, waffles, sandwiches, juices, morning dining — NOT traditional South Indian breakfast',
  drinks: 'bar, pub, lounge, brewery, cocktails, alcohol — NOT cafe or coffee shop',
  lunch: 'professional, quiet enough for conversation, suitable for business lunch',
}

const CUISINE_CONTEXT = {
  any: '',
  north_indian: 'North Indian cuisine, tandoor, curries, biryani, naan',
  south_indian: 'South Indian cuisine, dosa, idli, sambhar, rice dishes',
  continental: 'Continental cuisine, pasta, grills, salads, steaks, Western food',
  pan_asian: 'Pan Asian cuisine, sushi, Thai, Vietnamese, Korean, Japanese',
  chinese: 'Chinese cuisine, noodles, dim sum, stir fry, Manchurian',
  italian: 'Italian cuisine, pizza, pasta, risotto',
}

export async function POST(request) {
  try {
    const { category, cuisine, freeText, location } = await request.json()

    const categoryContext = CATEGORY_CONTEXT[category] || ''
    const cuisineContext = CUISINE_CONTEXT[cuisine] || ''

    // Step 1: Ask Claude to generate a precise search query
    const queryMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Generate a precise Google Places search query to find the best restaurants for the following:

Occasion: ${category} — ${categoryContext}
Cuisine: ${cuisineContext || 'no specific cuisine preference'}
Extra notes: ${freeText || 'none'}
Location: ${location}

Rules:
- Return ONLY the search query string, nothing else
- Be specific about the type of place, ambiance, and cuisine
- Include the location at the end
- Keep it under 10 words
- Examples: "romantic fine dining Italian restaurant Bandra Mumbai", "craft beer pub lounge HSR Layout Bangalore", "family friendly North Indian restaurant Faridabad"`,
        },
      ],
    })

    const searchQuery = queryMessage.content[0].text.trim().replace(/['"]/g, '')
    console.log('Generated search query:', searchQuery)

    // Step 2: Geocode the location for coordinates
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
    const geocodeRes = await fetch(geocodeUrl)
    const geocodeData = await geocodeRes.json()
    
    if (!geocodeData.results || geocodeData.results.length === 0) {
      return Response.json({ error: 'Location not found. Please try a different area.' }, { status: 400 })
    }
    
    const { lat, lng } = geocodeData.results[0].geometry.location
    
    // Step 3: Use Google Places Text Search with location bias
    const textSearchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.editorialSummary,places.photos,places.types',
      },
      body: JSON.stringify({
        textQuery: searchQuery,
        maxResultCount: 20,
        languageCode: 'en',
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 2000,
          },
        },
      }),
    })


    const placesData = await textSearchRes.json()

    if (!placesData.places || placesData.places.length === 0) {
      return Response.json({ error: 'No results found. Try a different location or occasion.' }, { status: 400 })
    }

    // Step 4: Filter by minimum rating
    const restaurantList = placesData.places
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

    if (restaurantList.length === 0) {
      return Response.json({ error: 'No highly rated results found. Try a different location or occasion.' }, { status: 400 })
    }

    // Step 5: Ask Claude to rank and explain
    const rankMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are a restaurant recommendation expert. A user is looking for: "${category}" restaurants in ${location}.

Occasion: ${categoryContext}
Cuisine preference: ${cuisineContext || 'none'}
Extra notes: ${freeText || 'none'}

Here are the candidate restaurants:

${JSON.stringify(restaurantList, null, 2)}

Select the top 6 most suitable restaurants. For each, explain in 1-2 sentences why it suits the user's occasion and preferences.

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

    const raw = rankMessage.content[0].text
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
