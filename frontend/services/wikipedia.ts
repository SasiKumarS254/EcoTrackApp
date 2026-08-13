/**
 * wikipedia.ts — Enhanced Species Data Enrichment Service
 *
 * Provides highly accurate species data and images when local curated data is insufficient.
 */

export interface WikiSpeciesData {
  extract: string;
  thumbnail: string | null;
  displayTitle: string;
}

export async function fetchWikipediaSpeciesData(speciesName: string): Promise<WikiSpeciesData | null> {
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

    return {
      extract: data.extract ? data.extract.replace(/Wikipedia/g, 'the Encyclopedia').trim() : "",
      thumbnail: data.thumbnail ? data.thumbnail.source : null,
      displayTitle: data.displaytitle || speciesName
    };
  } catch (error) {
    console.warn('[Wikipedia Enrichment] Failed to fetch silent data:', error);
  }
  return null;
}

export async function fetchWikipediaSummary(speciesName: string): Promise<string | null> {
  const data = await fetchWikipediaSpeciesData(speciesName);
  return data ? data.extract : null;
}
