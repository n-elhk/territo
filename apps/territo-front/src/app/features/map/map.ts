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
  PopupComponent,
} from '@maplibre/ngx-maplibre-gl';
import { DecimalPipe } from '@angular/common';
import type { GeocodingResult } from '@territo/schemas';
import {
  EMPTY_FC,
  EMPTY_SUGGESTIONS,
  MapService,
  type ZoneProperties,
} from './map.service';
import {
  FILL_PAINT,
  LEGEND,
  MAP_STYLE,
  OUTLINE_PAINT,
  PERIODS,
  SCORE_TYPES,
} from './map.constants';

function scoreColor(score: number): string {
  if (score >= 88) return '#22c55e';
  if (score >= 72) return '#84cc16';
  if (score >= 55) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

@Component({
  selector: 'app-map-page',
  imports: [
    MapComponent,
    GeoJSONSourceComponent,
    LayerComponent,
    PopupComponent,
    FormField,
    DecimalPipe,
  ],
  host: { class: 'flex flex-col h-screen' },
  template: `
    <!-- Header -->
    <header
      class="bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3 shrink-0 z-10"
    >
      <span class="text-lg font-bold text-gray-900 shrink-0">Territo</span>

      <!-- Recherche commune -->
      <div class="relative flex-1 max-w-md" (focusout)="onSearchBlur($event)">
        <input
          type="search"
          autocomplete="off"
          placeholder="Rechercher une commune…"
          [formField]="filterForm.search"
          (focus)="showSuggestions.set(true)"
          class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Recherche de commune"
          aria-autocomplete="list"
          aria-controls="suggestions-list"
          [attr.aria-expanded]="showSuggestions() && hasSuggestions()"
        />
        @if (showSuggestions() && hasSuggestions()) {
          <ul
            id="suggestions-list"
            role="listbox"
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
          >
            @for (
              item of suggestions.value().results;
              track item.commune_code + item.label
            ) {
              <li
                role="option"
                [attr.aria-selected]="false"
                class="px-4 py-2.5 text-sm hover:bg-indigo-50 cursor-pointer"
                (mousedown)="selectPlace(item)"
              >
                <span class="font-medium text-gray-800">{{ item.label }}</span>
                <span class="text-gray-400 ml-2 text-xs">{{
                  item.commune
                }}</span>
              </li>
            }
          </ul>
        }
      </div>

      <!-- Filtres -->
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
        <span class="text-xs text-indigo-500 animate-pulse shrink-0"
          >Chargement…</span
        >
      } @else if (selectedPlace()) {
        <span class="text-xs text-gray-400 shrink-0">
          {{ zonesResource.value().features.length }} zones
        </span>
      }
    </header>

    <!-- Carte -->
    <div class="flex-1 relative overflow-hidden">
      @if (!selectedPlace()) {
        <div
          class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
        >
          <div
            class="bg-white/90 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg text-center max-w-xs"
          >
            <p class="font-semibold text-gray-800">Recherchez une commune</p>
            <p class="text-gray-400 text-sm mt-1">
              Les scores s'afficheront sur la carte
            </p>
          </div>
        </div>
      }

      <mgl-map
        [mapStyle]="mapStyle"
        [center]="mapCenter()"
        [zoom]="mapZoom()"
        movingMethod="flyTo"
        [cursorStyle]="hovering() ? 'pointer' : ''"
        style="width:100%;height:100%"
        aria-label="Carte territoriale"
      >
        <mgl-geojson-source id="zones" [data]="$any(zonesResource.value())">
        </mgl-geojson-source>

        <mgl-layer
          id="zones-fill"
          type="fill"
          source="zones"
          [paint]="$any(fillPaint)"
          (layerClick)="onLayerClick($event)"
          (layerMouseEnter)="hovering.set(true)"
          (layerMouseLeave)="hovering.set(false)"
        >
        </mgl-layer>

        <mgl-layer
          id="zones-outline"
          type="line"
          source="zones"
          [paint]="$any(outlinePaint)"
        >
        </mgl-layer>

        @if (selectedFeature()) {
          <mgl-popup
            [lngLat]="$any(selectedFeature()!.lngLat)"
            [closeButton]="true"
            maxWidth="240px"
            (popupClose)="selectedFeature.set(null)"
          >
            <div class="p-2">
              <p class="font-semibold text-gray-900 text-sm">
                {{ selectedFeature()!.props.name }}
              </p>
              <div class="flex items-baseline gap-1 mt-2">
                <span
                  class="text-3xl font-bold"
                  [style.color]="selectedFeatureColor()"
                >
                  {{ selectedFeature()!.props.global_score | number: '1.0-0' }}
                </span>
                <span class="text-xs text-gray-400">/100</span>
              </div>
              @if (selectedFeature()!.props.trend_label) {
                <p class="mt-1 text-xs text-gray-500 capitalize">
                  {{ selectedFeature()!.props.trend_label }}
                </p>
              }
            </div>
          </mgl-popup>
        }
      </mgl-map>

      <!-- Légende -->
      <div
        class="absolute bottom-8 left-4 bg-white rounded-xl shadow-md p-3 text-xs z-10"
        role="note"
        aria-label="Légende des scores"
      >
        <p class="font-semibold text-gray-700 mb-2">Score /100</p>
        @for (entry of legend; track entry.label) {
          <div class="flex items-center gap-2 mb-1.5">
            <span
              class="w-3 h-3 rounded-sm shrink-0"
              [style.background]="entry.color"
            ></span>
            <span class="text-gray-600">{{ entry.label }}</span>
          </div>
        }
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
  readonly scoreTypes = SCORE_TYPES;
  readonly periods = PERIODS;
  readonly legend = LEGEND;

  readonly showSuggestions = signal(false);
  readonly hovering = signal(false);
  readonly selectedPlace = signal<GeocodingResult | null>(null);
  readonly selectedFeature = signal<{
    lngLat: [number, number];
    props: ZoneProperties;
  } | null>(null);

  readonly filterModel = signal({
    search: '',
    scoreType: 'prospection_locale',
    period: '12m',
  });
  readonly filterForm = form(this.filterModel, (s) => {
    debounce(s.search, 300);
  });

  readonly mapCenter = computed<[number, number]>(() => {
    const p = this.selectedPlace();
    return p ? [p.lng, p.lat] : [2.3522, 46.8];
  });

  readonly mapZoom = computed<[number]>(() =>
    this.selectedPlace() ? [13] : [5.5],
  );

  readonly selectedFeatureColor = computed(() => {
    const f = this.selectedFeature();
    if (!f) return '#94a3b8';
    const { score_visibility, global_score } = f.props;
    if (score_visibility === 'greyed' || score_visibility === 'hidden')
      return '#94a3b8';
    return scoreColor(global_score);
  });

  readonly hasSuggestions = computed(
    () => this.suggestions.value().results.length > 0,
  );

  readonly suggestions = rxResource({
    params: () => {
      const q = this.filterModel().search.trim();
      return q.length >= 3 ? q : undefined;
    },
    stream: ({ params: q }) => this.mapService.searchCommunes(q),
    defaultValue: EMPTY_SUGGESTIONS,
  });

  readonly zonesResource = rxResource({
    params: () => {
      const place = this.selectedPlace();
      if (!place) return undefined;
      return {
        territoryCode: place.commune_code,
        scoreType: this.filterModel().scoreType,
        period: this.filterModel().period,
      };
    },
    stream: ({ params }) =>
      this.mapService.getZonesGeoJson(
        params.territoryCode,
        params.scoreType,
        params.period,
      ),
    defaultValue: EMPTY_FC,
  });

  onSearchBlur(event: FocusEvent) {
    const related = event.relatedTarget as HTMLElement | null;
    if (!related?.closest('#suggestions-list')) {
      this.showSuggestions.set(false);
    }
  }

  selectPlace(place: GeocodingResult) {
    this.selectedPlace.set(place);
    this.filterModel.update((m) => ({ ...m, search: place.label }));
    this.showSuggestions.set(false);
    this.selectedFeature.set(null);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLayerClick(event: any) {
    const feature = event.features?.[0];
    if (!feature) return;
    this.selectedFeature.set({
      lngLat: [event.lngLat.lng, event.lngLat.lat],
      props: feature.properties as ZoneProperties,
    });
  }
}
