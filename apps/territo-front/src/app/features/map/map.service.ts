import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { GeocodingSearchResponse, ZoneFeatureCollection } from '@territo/schemas';

export { type ZoneProperties, type ZoneFeatureCollection } from '@territo/schemas';

export const EMPTY_SUGGESTIONS: GeocodingSearchResponse = { results: [] };
export const EMPTY_FC: ZoneFeatureCollection = { type: 'FeatureCollection', features: [] };

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly http = inject(HttpClient);

  searchCommunes(q: string) {
    return this.http.get<GeocodingSearchResponse>(
      `/api/geocoding/search?q=${encodeURIComponent(q)}&limit=6&type=municipality`,
    );
  }

  getZonesGeoJson(territoryCode: string, scoreType: string, period: string) {
    const params = new URLSearchParams({ territory_code: territoryCode, score_type: scoreType, period });
    return this.http.get<ZoneFeatureCollection>(`/api/zones/geojson?${params}`);
  }
}
