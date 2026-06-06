import { Injectable } from '@nestjs/common';

const BAN_SEARCH_URL = 'https://api-adresse.data.gouv.fr/search/';
const BAN_REVERSE_URL = 'https://api-adresse.data.gouv.fr/reverse/';

export interface BanFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    label: string;
    score: number;
    id: string;
    type: string;
    name: string;
    postcode: string;
    citycode: string;
    city: string;
    context: string;
    x: number;
    y: number;
  };
}

export interface BanResponse {
  type: 'FeatureCollection';
  features: BanFeature[];
}

@Injectable()
export class GeocodingService {
  async search(q: string, limit = 5, type?: string): Promise<BanFeature[]> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (type) params.set('type', type);

    const res = await fetch(`${BAN_SEARCH_URL}?${params}`);
    if (!res.ok) return [];

    const data = (await res.json()) as BanResponse;
    return data.features ?? [];
  }

  async reverse(lat: number, lng: number): Promise<BanFeature | null> {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng) });
    const res = await fetch(`${BAN_REVERSE_URL}?${params}`);
    if (!res.ok) return null;

    const data = (await res.json()) as BanResponse;
    return data.features?.[0] ?? null;
  }

  formatFeature(f: BanFeature) {
    return {
      label: f.properties.label,
      score: f.properties.score,
      commune_code: f.properties.citycode,
      commune: f.properties.city,
      postcode: f.properties.postcode,
      type: f.properties.type,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    };
  }
}
