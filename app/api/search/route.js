import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { category, freeText, location } = await request.json()

    // Step 1: Geocode the location
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
    const geocodeRes = await fetch(geocodeUrl)
    const geocodeData = await geocodeRes.json()

    if (!geocodeData.results || geocodeData.results.length === 0) {
      return Response.json({ error: 'Location not found. Please try a different area.' }, { status: 400 })
    }

    const { lat, lng } = geocodeData.results[0].geometry.location

    // Step 2: Search for restaurants
    const placesUrl = `https://places.googleapis.com/v1/places:searchNearby`
    const placesRes = await fetch(placesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.types,places.editorialSummary',
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

    // Step 3: Format for Claude
    const restaurantList = placesData.places.map((p, i) => ({
      index: i + 1,
      name: p.displayName?.text || 'Unknown',
      address: p.formattedAddress || '',
      rating: p.rating || 'No rating',
      priceLevel: p.priceLevel || null,
      description: p.editorialSummary?.text || '',
    }))

    // Step 4: Ask Claude to rank
    const purpose = [category, freeText].filter(Boolean).join(' — ')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a restaurant recommendation expert. A user is looking for restaurants for the following purpose: "${purpose}".

Here is a list of restaurants in ${location}:

${JSON.stringify(restaurantList, null, 2)}

Please select the top 5 most suitable restaurants for the user's purpose. For each one, explain in 1-2 sentences why it suits their needs.

You must respond with ONLY a raw JSON object. No markdown, no backticks, no code blocks, no explanation. Just the raw JSON object starting with { and ending with }.

Use this exact format:
{
  "summary": "A 1-2 sentence overall recommendation summary for the user",
  "restaurants": [
    {
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

    // Step 5: Parse response
    const raw = message.content[0].text
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return Response.json(parsed)
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
