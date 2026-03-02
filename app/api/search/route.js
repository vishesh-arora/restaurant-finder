import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { category, freeText, location } = await request.json()

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
    const geocodeRes = await fetch(geocodeUrl)
    const geocodeData = await geocodeRes.json()

    if (!geocodeData.results || geocodeData.results.length === 0) {
      return Response.json({ error: 'Location not found. Please try a different area.' }, { status: 400 })
    }

    const { lat, lng } = geocodeData.results[0].geometry.location

    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.editorialSummary,places.photos',
      },
      body: JSON.stringify({
        includedTypes: ['restaurant'],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 2000,
          },
        },
      }),
    })

    const placesData = await placesRes.json()

    if (!placesData.places || placesData.places.length === 0) {
      return Response.json({ error: 'No restaurants found in this area. Try a different location.' }, { status: 400 })
    }

    const restaurantList = placesData.places.map((p, i) => ({
      index: i + 1,
      name: p.displayName?.text || 'Unknown',
      address: p.formattedAddress || '',
      rating: p.rating || 'No rating',
      priceLevel: p.priceLevel || null,
      description: p.editorialSummary?.text || '',
      photoName: p.photos?.[0]?.name || null,
    }))

    const purpose = [category, freeText].filter(Boolean).join(' — ')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are a restaurant recommendation expert. A user is looking for restaurants for: "${purpose}".

Here are restaurants in ${location}:

${JSON.stringify(restaurantList, null, 2)}

Select the top 6 most suitable restaurants. For each, explain in 1-2 sentences why it suits the user's purpose.

IMPORTANT: You must respond with ONLY a raw JSON object. No markdown. No backticks. No extra text. No trailing commas. Just valid JSON starting with { and ending with }.

Use exactly this format:
{
  "summary": "1-2 sentence overall recommendation summary",
  "restaurants": [
    {
      "index": 1,
      "name": "Restaurant Name",
      "address": "Full address",
      "rating": 4.5,
      "priceLevel": 2,
      "reason": "Why this suits the user's purpose"
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
        return { ...r, photoUrl }
      })
    )

    return Response.json({ summary: parsed.summary, restaurants: results })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
