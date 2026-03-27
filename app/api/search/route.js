import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORY_CONTEXT = {
  romantic: 'fine dining, intimate ambiance, candlelit restaurants, upscale cuisine',
  family: 'family-friendly restaurants, comfortable seating, varied menu for all ages',
  birthday: 'celebratory restaurants, good ambiance, desserts, lively atmosphere',
  brunch: 'brunch spots serving eggs, pancakes, waffles, sandwiches, juices, coffee — NOT traditional South Indian breakfast places like idli, dosa, filter coffee joints',
  drinks: 'bars, pubs, lounges, breweries, places that serve alcohol and cocktails — NOT cafes or coffee shops',
  lunch: 'professional restaurants suitable for business lunch, quiet enough for conversation',
}

const CUISINE_CONTEXT = {
  any: '',
  north_indian: 'North Indian cuisine — tandoor, curries, dal, naan, biryani',
  south_indian: 'South Indian cuisine — dosa, idli, sambhar, rasam, rice dishes',
  continental: 'Continental/Western cuisine — pastas, grills, salads, burgers, steaks',
  pan_asian: 'Pan Asian cuisine — sushi, Thai, Vietnamese, Korean, Japanese',
  chinese: 'Chinese cuisine — noodles, dim sum, stir fry, Manchurian',
  italian: 'Italian cuisine — pizza, pasta, risotto, tiramisu',
}

export async function POST(request) {
  try {
    const { category, cuisine, freeText, location } = await request.json()

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
    const geocodeRes = await fetch(geocodeUrl)
    const geocodeData = await geocodeRes.json()

    if (!geocodeData.results || geocodeData.results.length === 0) {
      return Response.json({ error: 'Location not found. Please try a different area.' }, { status: 400 })
    }

    const { lat, lng } = geocodeData.results[0].geometry.location

    const includedTypes = category === 'drinks'
      ? ['bar', 'pub', 'night_club', 'wine_bar']
      : ['restaurant']

    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.editorialSummary,places.photos,places.types',
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 1500,
          },
        },
      }),
    })

    const placesData = await placesRes.json()

    if (!placesData.places || placesData.places.length === 0) {
      return Response.json({ error: 'No results found in this area. Try a different location.' }, { status: 400 })
    }

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

    const purpose = [category, freeText].filter(Boolean).join(' — ')
    const categoryContext = CATEGORY_CONTEXT[category] || ''
    const cuisineContext = CUISINE_CONTEXT[cuisine] || ''

    const cuisineInstruction = cuisine && cuisine !== 'any'
      ? `The user specifically wants ${cuisineContext}. Only recommend places that serve this cuisine. Exclude any place that does not match.`
      : 'The user has no cuisine preference — recommend based on occasion fit and quality.'

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are a restaurant recommendation expert. A user is looking for: "${purpose}".

Occasion context: ${categoryContext}
Cuisine instruction: ${cuisineInstruction}
Additional notes: ${freeText || 'none'}

Here are places in ${location}:

${JSON.stringify(restaurantList, null, 2)}

Select the top 6 most suitable places that genuinely match BOTH the occasion AND the cuisine preference above.
For "brunch" occasions, only include places that serve a proper brunch menu — eggs, pancakes, waffles, sandwiches. Exclude traditional South Indian breakfast places unless the user specifically asked for South Indian cuisine.
For "drinks" occasions, only include bars, pubs, lounges or places that clearly serve alcohol. Exclude cafes entirely.
For each place, explain in 1-2 sentences why it suits the user's purpose.

IMPORTANT: Respond with ONLY raw valid JSON. No markdown. No backticks. No trailing commas. Just JSON starting with { and ending with }.

{
  "summary": "1-2 sentence overall summary",
  "restaurants": [
    {
      "index": 1,
      "name": "Place Name",
      "address": "Full address",
      "rating": 4.5,
      "priceLevel": 2,
      "reason": "Why this suits the occasion and cuisine"
    }
  ]
}`,
        },
      ],
    })

    const raw = message.content[0].text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid response from AI')

    const cleaned = jsonMatch[0]
      .replace(/,\s*\]/g, ']')
      .replace(/,\s*\}/g, '}')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')

    const parsed = JSON.parse(cleaned)

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

    return Response.json({ summary: parsed.summary, restaurants: results })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
