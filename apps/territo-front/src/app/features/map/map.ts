import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, FormField, debounce } from '@angular/forms/signals';
import {
  GeoJSONSourceComponent,
  LayerComponent,
  MapComponent,
} from '@maplibre/ngx-maplibre-gl';
import type { GeocodingResult } from '@territo/schemas';
import { EMPTY_FC, EMPTY_SUGGESTIONS, MapService } from './map.service';
import { FILL_PAINT, MAP_STYLE, OUTLINE_PAINT, PERIODS, SCORE_TYPES } from './map.constants';
import { MapSearchComponent } from './map-search';
import { MapZoneListComponent, type ZoneListItem } from './map-zone-list';
import { MapZoneDetailComponent } from './map-zone-detail';

const SCORE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SCORE_TYPES.map((s) => [s.value, s.label]),
);

@Component({
  selector: 'app-map-page',
  imports: [
    MapComponent,
    GeoJSONSourceComponent,
    LayerComponent,
    FormField,
    MapSearchComponent,
    MapZoneListComponent,
    MapZoneDetailComponent,
  ],
  host: { class: 'flex flex-col h-screen' },
  template: `
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3 shrink-0 z-10">
      <span class="text-lg font-bold text-gray-900 shrink-0">Territo</span>

      <div class="flex-1 max-w-sm">
        <app-map-search
          [field]="filterForm.search"
          [suggestions]="suggestions.value()"
          (placeSelected)="selectPlace($event)"
        />
      </div>

      <select
        [formField]="filterForm.scoreType"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Type de score"
      >
        @for (opt of scoreTypes; track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>

      <select
        [formField]="filterForm.period"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Période"
      >
        @for (opt of periods; track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>

      @if (zonesResource.isLoading()) {
        <span class="text-xs text-indigo-500 animate-pulse shrink-0">Chargement…</span>
      }
    </header>

    <!-- Body -->
    <div class="flex-1 flex overflow-hidden">

      <!-- Sidebar -->
      <aside class="w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden"
        aria-label="Panneau latéral">

        @if (!selectedPlace()) {
          <div class="flex flex-col items-center justify-center flex-1 text-center px-6">
            <div class="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
              </svg>
            </div>
            <p class="font-semibold text-gray-700 text-sm">Recherchez une commune</p>
            <p class="text-xs text-gray-400 mt-1">Les zones s'afficheront sur la carte</p>
          </div>

        } @else if (selectedZoneId()) {
          <app-map-zone-detail
            [zoneId]="selectedZoneId()!"
            [scoreType]="filterModel().scoreType"
            [period]="filterModel().period"
            [scoreTypeLabel]="scoreTypeLabel()"
            (back)="clearZone()"
          />

        } @else {
          <app-map-zone-list
            [zones]="sortedZones()"
            (zoneSelected)="selectZone($event)"
          />
        }
      </aside>

      <!-- Carte -->
      <div class="flex-1 relative">
        <mgl-map
          [mapStyle]="mapStyle"
          [center]="$any(mapCenter())"
          [zoom]="$any(mapZoom())"
          movingMethod="flyTo"
          [cursorStyle]="hovering() ? 'pointer' : ''"
          style="width:100%;height:100%"
          aria-label="Carte territoriale"
        >
          <mgl-geojson-source id="zones" [data]="$any(zonesResource.value())"/>

          <mgl-layer id="zones-fill" type="fill" source="zones"
            [paint]="$any(fillPaint)"
            (layerClick)="onLayerClick($event)"
            (layerMouseEnter)="hovering.set(true)"
            (layerMouseLeave)="hovering.set(false)"/>

          <mgl-layer id="zones-outline" type="line" source="zones"
            [paint]="$any(outlinePaint)"/>

          <mgl-layer id="zones-selected" type="line" source="zones"
            [paint]="$any(selectedOutlinePaint)"
            [filter]="$any(selectedZoneFilter())"/>
        </mgl-map>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPageComponent {
  private readonly mapService = inject(MapService);

  readonly mapStyle = MAP_STYLE;
  readonly fillPaint = FILL_PAINT;
  readonly outlinePaint = OUTLINE_PAINT;
  readonly selectedOutlinePaint = { 'line-color': '#6366f1', 'line-width': 3 };
  readonly scoreTypes = SCORE_TYPES;
  readonly periods = PERIODS;

  readonly hovering = signal(false);
  readonly selectedPlace = signal<GeocodingResult | null>(null);
  readonly selectedZoneId = signal<string | null>(null);

  readonly filterModel = signal({ search: '', scoreType: 'prospection_locale', period: '12m' });
  readonly filterForm = form(this.filterModel, (s) => { debounce(s.search, 300); });

  readonly mapCenter = computed(() => {
    const p = this.selectedPlace();
    return p ? [p.lng, p.lat] : [2.3522, 46.8];
  });
  readonly mapZoom = computed(() => (this.selectedPlace() ? [13] : [5.5]));
  readonly scoreTypeLabel = computed(() => SCORE_TYPE_LABELS[this.filterModel().scoreType] ?? '');
  readonly selectedZoneFilter = computed(() =>
    this.selectedZoneId()
      ? ['==', ['get', 'zone_id'], this.selectedZoneId()]
      : ['==', ['get', 'zone_id'], ''],
  );

  readonly suggestions = rxResource({
    params: () => { const q = this.filterModel().search.trim(); return q.length >= 3 ? q : undefined; },
    stream: ({ params: q }) => this.mapService.searchCommunes(q),
    defaultValue: EMPTY_SUGGESTIONS,
  });

  readonly zonesResource = rxResource({
    params: () => {
      const place = this.selectedPlace();
      if (!place) return undefined;
      return { territoryCode: place.commune_code, scoreType: this.filterModel().scoreType, period: this.filterModel().period };
    },
    stream: ({ params }) =>
      this.mapService.getZonesGeoJson(params.territoryCode, params.scoreType, params.period),
    defaultValue: EMPTY_FC,
  });

  readonly sortedZones = computed((): ZoneListItem[] =>
    [...this.zonesResource.value().features]
      .sort((a, b) => b.properties.global_score - a.properties.global_score)
      .map((f) => f.properties as ZoneListItem),
  );

  selectPlace(place: GeocodingResult) {
    this.selectedPlace.set(place);
    this.filterModel.update((m) => ({ ...m, search: place.label }));
    this.selectedZoneId.set(null);
  }

  selectZone(zoneId: string) { this.selectedZoneId.set(zoneId); }
  clearZone() { this.selectedZoneId.set(null); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLayerClick(event: any) {
    const feature = event.features?.[0];
    if (!feature) return;
    this.selectedZoneId.set(feature.properties['zone_id']);
  }
}
