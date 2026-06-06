import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const BAN_SEARCH_URL = 'https://api-adresse.data.gouv.fr/search/';
const BAN_REVERSE_URL = 'https://api-adresse.data.gouv.fr/reverse/';

const banFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    label: z.string(),
    score: z.number(),
    id: z.string(),
    type: z.string(),
    name: z.string(),
    postcode: z.string(),
    citycode: z.string(),
    city: z.string(),
    context: z.string(),
    x: z.number(),
    y: z.number(),
  }),
});

const banResponseSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(banFeatureSchema),
});

type BanFeature = z.infer<typeof banFeatureSchema>;

@Injectable()
export class GeocodingService {
  async search(q: string, limit = 5, type?: string): Promise<BanFeature[]> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (type) params.set('type', type);

    const res = await fetch(`${BAN_SEARCH_URL}?${params}`);
    if (!res.ok) return [];

    const data = banResponseSchema.parse(await res.json());
    return data.features;
  }

  async reverse(lat: number, lng: number): Promise<BanFeature | null> {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng) });
    const res = await fetch(`${BAN_REVERSE_URL}?${params}`);
    if (!res.ok) return null;

    const data = banResponseSchema.parse(await res.json());
    return data.features[0] ?? null;
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
