import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  GeoJSONSourceComponent,
  LayerComponent,
  MapComponent,
} from '@maplibre/ngx-maplibre-gl';
import { EMPTY_FC, EMPTY_SUGGESTIONS, MapService } from './map.service';
import { FILL_PAINT, MAP_STYLE, OUTLINE_PAINT, PERIODS, SCORE_TYPES } from './map.constants';
import { MapSearchComponent } from './map-search';
import { MapZoneListComponent, type ZoneListItem } from './map-zone-list';
import { MapZoneDetailComponent } from './map-zone-detail';
import { MapStore } from './map.store';

@Component({
  selector: 'app-map-page',
  imports: [
    MapComponent,
    GeoJSONSourceComponent,
    LayerComponent,
    MapSearchComponent,
    MapZoneListComponent,
    MapZoneDetailComponent,
  ],
  providers: [MapStore],
  host: { class: 'flex flex-col h-screen' },
  template: `
    <!-- Header minimal -->
    <header class="bg-white border-b border-gray-200 px-4 h-12 flex items-center justify-between shrink-0 z-10">
      <span class="font-bold text-gray-900 tracking-tight">Territo</span>
      @if (zonesResource.isLoading()) {
        <span class="text-xs text-indigo-500 animate-pulse" aria-live="polite">Chargement…</span>
      }
    </header>

    <!-- Body -->
    <div class="flex-1 flex overflow-hidden">

      <!-- Panneau gauche : liste des zones -->
      @if (store.leftPanelOpen()) {
        <aside
          class="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden"
          aria-label="Liste des zones"
        >
          <!-- Toggle fermer -->
          <div class="flex justify-end px-2 pt-2 shrink-0">
            <button
              type="button"
              (click)="store.setLeftPanel(false)"
              class="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition"
              aria-label="Fermer le panneau"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/>
              </svg>
            </button>
          </div>

          @if (!store.selectedPlace()) {
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
          } @else {
            <app-map-zone-list
              [zones]="sortedZones()"
              (zoneSelected)="store.selectZone($event)"
            />
          }
        </aside>
      }

      <!-- Centre : carte + filtres flottants -->
      <div class="flex-1 relative overflow-hidden">

        <!-- Bouton ré-ouvrir panneau gauche -->
        @if (!store.leftPanelOpen()) {
          <button
            type="button"
            (click)="store.setLeftPanel(true)"
            class="absolute left-3 top-3 z-10 bg-white/95 backdrop-blur-sm border border-gray-100 shadow-lg rounded-xl p-2 text-gray-400 hover:text-gray-700 hover:bg-white transition"
            aria-label="Ouvrir le panneau des zones"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M6 5l7 7-7 7"/>
            </svg>
          </button>
        }

        <!-- Barre de filtres flottante -->
        <div class="absolute top-3 inset-x-3 z-10 flex justify-center pointer-events-none">
          <div
            class="flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 px-3 py-2 pointer-events-auto"
            style="max-width: 640px; width: 100%"
            role="search"
            aria-label="Filtres de la carte"
          >
            <div class="flex-1 min-w-0">
              <app-map-search
                [value]="store.searchRaw()"
                [suggestions]="suggestions.value()"
                (searchChange)="store.typeSearch($event)"
                (placeSelected)="store.selectPlace($event)"
              />
            </div>

            <div class="w-px h-5 bg-gray-200 shrink-0 mx-1" aria-hidden="true"></div>

            <select
              [value]="store.scoreType()"
              (change)="store.setScoreType($any($event.target).value)"
              class="text-sm text-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg cursor-pointer pr-1 shrink-0"
              aria-label="Type de score"
            >
              @for (opt of scoreTypes; track opt.value) {
                <option [value]="opt.value" [selected]="opt.value === store.scoreType()">{{ opt.label }}</option>
              }
            </select>

            <div class="w-px h-5 bg-gray-200 shrink-0 mx-1" aria-hidden="true"></div>

            <select
              [value]="store.period()"
              (change)="store.setPeriod($any($event.target).value)"
              class="text-sm text-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg cursor-pointer pr-1 shrink-0"
              aria-label="Période"
            >
              @for (opt of periods; track opt.value) {
                <option [value]="opt.value" [selected]="opt.value === store.period()">{{ opt.label }}</option>
              }
            </select>
          </div>
        </div>

        <!-- Carte -->
        <mgl-map
          [mapStyle]="mapStyle"
          [center]="store.mapCenter()"
          [zoom]="store.mapZoom()"
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
            [filter]="$any(store.selectedZoneFilter())"/>
        </mgl-map>
      </div>

      <!-- Panneau droit : détail zone -->
      @if (store.selectedZoneId()) {
        <aside
          class="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden"
          aria-label="Détail de la zone sélectionnée"
        >
          <app-map-zone-detail
            [zoneId]="store.selectedZoneId()!"
            [scoreType]="store.scoreType()"
            [period]="store.period()"
            [scoreTypeLabel]="store.scoreTypeLabel()"
            (back)="store.clearZone()"
          />
        </aside>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPageComponent {
  private readonly mapService = inject(MapService);
  readonly store = inject(MapStore);

  readonly mapStyle = MAP_STYLE;
  readonly fillPaint = FILL_PAINT;
  readonly outlinePaint = OUTLINE_PAINT;
  readonly selectedOutlinePaint = { 'line-color': '#6366f1', 'line-width': 3 };
  readonly scoreTypes = SCORE_TYPES;
  readonly periods = PERIODS;

  readonly hovering = signal(false);

  readonly suggestions = rxResource({
    params: () => {
      const q = this.store.search().trim();
      return q.length >= 3 ? q : undefined;
    },
    stream: ({ params: q }) => this.mapService.searchCommunes(q),
    defaultValue: EMPTY_SUGGESTIONS,
  });

  readonly zonesResource = rxResource({
    params: () => this.store.filterParams(),
    stream: ({ params }) =>
      this.mapService.getZonesGeoJson(params.territoryCode, params.scoreType, params.period),
    defaultValue: EMPTY_FC,
  });

  readonly sortedZones = computed((): ZoneListItem[] =>
    [...this.zonesResource.value().features]
      .sort((a, b) => b.properties.global_score - a.properties.global_score)
      .map((f) => f.properties as ZoneListItem),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLayerClick(event: any) {
    const feature = event.features?.[0];
    if (!feature) return;
    this.store.selectZone(feature.properties['zone_id']);
  }
}
