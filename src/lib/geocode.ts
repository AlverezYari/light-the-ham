/**
 * Geocoding Utility
 *
 * Converts street addresses to latitude/longitude coordinates.
 * Uses Google Maps Geocoding API (primary) with Nominatim as fallback.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export interface GeocodeError {
  error: string;
  code: 'NOT_FOUND' | 'OUT_OF_BOUNDS' | 'API_ERROR';
}

// Greater Birmingham Metro Area bounding box (7-county MSA)
// Covers: Jefferson, Shelby, St. Clair, Blount, Walker, Chilton, Bibb counties
const BIRMINGHAM_BOUNDS = {
  minLat: 32.6, // South (Chilton County)
  maxLat: 34.2, // North (Blount County)
  minLng: -87.5, // West (Walker County)
  maxLng: -86.0, // East (St. Clair County / Pell City)
};

/**
 * Check if coordinates are within Greater Birmingham Metro Area
 */
export function isInBirminghamArea(lat: number, lng: number): boolean {
  return (
    lat >= BIRMINGHAM_BOUNDS.minLat &&
    lat <= BIRMINGHAM_BOUNDS.maxLat &&
    lng >= BIRMINGHAM_BOUNDS.minLng &&
    lng <= BIRMINGHAM_BOUNDS.maxLng
  );
}

/**
 * Geocode using Google Maps Geocoding API
 */
async function geocodeWithGoogle(
  address: string,
  city: string,
  state: string,
  zip: string,
): Promise<GeocodeResult | GeocodeError | null> {
  // Check both import.meta.env (dev) and process.env (prod)
  const apiKey = import.meta.env?.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.log('   ⚠️ No GOOGLE_MAPS_API_KEY found');
    return null; // No API key, skip Google
  }

  const query = `${address}, ${city}, ${state} ${zip}, USA`;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', apiKey);
  // Bias results to Alabama
  url.searchParams.set('components', 'administrative_area:AL|country:US');

  try {
    console.log('📍 Geocoding with Google:', query);
    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('Google Geocoding API error:', response.status);
      return null; // Fall back to Nominatim
    }

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      return {
        error: 'Address not found. Please check the address and try again.',
        code: 'NOT_FOUND',
      };
    }

    if (data.status !== 'OK') {
      console.error('Google Geocoding API status:', data.status, data.error_message);
      return null; // Fall back to Nominatim
    }

    const result = data.results[0];
    const lat = result.geometry.location.lat;
    const lng = result.geometry.location.lng;

    // Validate coordinates are in Greater Birmingham Metro Area
    if (!isInBirminghamArea(lat, lng)) {
      return {
        error: 'This address appears to be outside the Greater Birmingham Metro Area.',
        code: 'OUT_OF_BOUNDS',
      };
    }

    console.log(`   ✓ Google found: ${lat}, ${lng}`);
    return {
      lat,
      lng,
      displayName: result.formatted_address,
    };
  } catch (err) {
    console.error('Google Geocoding error:', err);
    return null; // Fall back to Nominatim
  }
}

/**
 * Geocode using OpenStreetMap Nominatim (free fallback)
 */
async function geocodeWithNominatim(
  address: string,
  city: string,
  state: string,
  zip: string,
): Promise<GeocodeResult | GeocodeError> {
  const query = `${address}, ${city}, ${state} ${zip}, USA`;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  try {
    console.log('📍 Geocoding with Nominatim:', query);
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'LightTheHam/1.0 (christmas-lights-guide)',
      },
    });

    if (!response.ok) {
      return {
        error: `Geocoding API returned ${response.status}`,
        code: 'API_ERROR',
      };
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return {
        error: 'Address not found. Please check the address and try again.',
        code: 'NOT_FOUND',
      };
    }

    const result = results[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // Validate coordinates are in Greater Birmingham Metro Area
    if (!isInBirminghamArea(lat, lng)) {
      return {
        error: 'This address appears to be outside the Greater Birmingham Metro Area.',
        code: 'OUT_OF_BOUNDS',
      };
    }

    console.log(`   ✓ Nominatim found: ${lat}, ${lng}`);
    return {
      lat,
      lng,
      displayName: result.display_name,
    };
  } catch (err) {
    console.error('Nominatim Geocoding error:', err);
    return {
      error: 'Failed to geocode address. Please try again.',
      code: 'API_ERROR',
    };
  }
}

/**
 * Geocode an address to lat/lng coordinates
 *
 * Tries Google Maps API first (better coverage), falls back to Nominatim
 *
 * @param address - Street address (e.g., "123 Main St")
 * @param city - City name (e.g., "Birmingham")
 * @param state - State (default: "AL")
 * @param zip - ZIP code
 * @returns Coordinates or error
 */
export async function geocodeAddress(
  address: string,
  city: string,
  state: string = 'AL',
  zip: string,
): Promise<GeocodeResult | GeocodeError> {
  // Try Google first (better address coverage)
  const googleResult = await geocodeWithGoogle(address, city, state, zip);

  if (googleResult !== null) {
    return googleResult;
  }

  // Fall back to Nominatim
  console.log('   ⚠️ Falling back to Nominatim');
  return geocodeWithNominatim(address, city, state, zip);
}

/**
 * Type guard to check if result is an error
 */
export function isGeocodeError(result: GeocodeResult | GeocodeError): result is GeocodeError {
  return 'error' in result;
}
