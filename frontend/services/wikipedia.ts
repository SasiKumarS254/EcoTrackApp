/**
 * wikipedia.ts — Silent Wikipedia API Fallback Service
 *
 * Provides highly accurate species data when local curated data is insufficient.
 * Adheres to strict "No Branding" policy — data is presented as native app info.
 */

export async function fetchWikipediaSummary(speciesName: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(speciesName);
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${query}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EcoTrackApp/1.0 (https://ecotrack.example.com; contact@example.com)'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();

    // Extract extract (silent fallback)
    if (data.extract) {
      // Clean any Wikipedia references if they exist (though usually they don't in extracts)
      return data.extract.replace(/Wikipedia/g, 'the Encyclopedia').trim();
    }
  } catch (error) {
    console.warn('[Wikipedia Fallback] Failed to fetch silent data:', error);
  }
  return null;
}
