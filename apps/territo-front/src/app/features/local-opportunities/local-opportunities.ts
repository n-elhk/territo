import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { form, FormField, debounce } from '@angular/forms/signals';
import { MapService, EMPTY_SUGGESTIONS } from '../map/map.service';
import type { GeocodingResult, RisingZonesResponse } from '@territo/schemas';

const SCORE_TYPES = [
  { value: 'prospection_locale', label: 'Prospection locale' },
  { value: 'demande_btp', label: 'Demande BTP' },
  { value: 'transformation_immo', label: 'Transformation immo' },
  { value: 'liquidite_marche', label: 'Liquidité marché' },
  { value: 'valorisation_prix', label: 'Valorisation prix' },
] as const;

const PERIODS = [
  { value: '3m', label: '3 mois' },
  { value: '6m', label: '6 mois' },
  { value: '12m', label: '12 mois' },
  { value: '24m', label: '24 mois' },
] as const;

const EMPTY_RESPONSE: RisingZonesResponse = {
  territory_code: '',
  score_type: 'prospection_locale' as never,
  period: '12m' as never,
  zones: [],
};

function scoreColor(score: number): string {
  if (score >= 88) return '#22c55e';
  if (score >= 72) return '#84cc16';
  if (score >= 55) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

@Component({
  selector: 'app-local-opportunities',
  imports: [RouterLink, DecimalPipe, FormField],
  host: { class: 'flex flex-col min-h-screen bg-gray-50' },
  template: `
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3 shrink-0">
      <a routerLink="/" class="text-lg font-bold text-gray-900 shrink-0 hover:text-indigo-600 transition-colors">
        Territo
      </a>
      <span class="text-gray-300">/</span>
      <span class="text-sm font-medium text-gray-600">Opportunités locales</span>

      <!-- Recherche commune -->
      <div class="relative flex-1 max-w-md ml-4" (focusout)="onSearchBlur($event)">
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
            @for (item of suggestions.value().results; track item.commune_code) {
              <li
                role="option"
                [attr.aria-selected]="false"
                class="px-4 py-2.5 text-sm hover:bg-indigo-50 cursor-pointer"
                (mousedown)="selectPlace(item)"
              >
                <span class="font-medium text-gray-800">{{ item.label }}</span>
                <span class="text-gray-400 ml-2 text-xs">{{ item.commune }}</span>
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
    </header>

    <!-- Contenu -->
    <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-8">

      @if (!selectedPlace()) {
        <!-- État vide -->
        <div class="flex flex-col items-center justify-center py-24 text-center">
          <div class="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
            </svg>
          </div>
          <p class="font-semibold text-gray-800 text-lg">Choisissez une commune</p>
          <p class="text-gray-400 text-sm mt-1">Les zones en progression s'afficheront ici</p>
        </div>

      } @else if (zonesResource.isLoading()) {
        <!-- Skeleton -->
        <div class="space-y-3" aria-busy="true" aria-label="Chargement en cours">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-xl bg-gray-100 shrink-0"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-4 bg-gray-100 rounded w-1/3"></div>
                  <div class="h-3 bg-gray-100 rounded w-1/4"></div>
                </div>
                <div class="w-16 h-6 bg-gray-100 rounded-full"></div>
              </div>
            </div>
          }
        </div>

      } @else if (zones().length === 0) {
        <!-- Aucun résultat -->
        <div class="text-center py-16">
          <p class="text-gray-500 font-medium">Aucune zone en progression sur cette commune</p>
          <p class="text-gray-400 text-sm mt-1">Essayez une autre période ou un autre type de score</p>
        </div>

      } @else {
        <!-- Titre -->
        <div class="flex items-baseline justify-between mb-4">
          <h1 class="text-lg font-bold text-gray-900">
            {{ selectedPlace()!.commune }}
          </h1>
          <span class="text-sm text-gray-400">{{ zones().length }} zones en hausse</span>
        </div>

        <!-- Liste -->
        <ol class="space-y-3" aria-label="Zones classées par progression de score">
          @for (zone of zones(); track zone.zone_id; let rank = $index) {
            <li>
              <article
                class="bg-white rounded-xl border border-gray-100 p-4 hover:border-indigo-200 hover:shadow-sm transition group"
                [attr.aria-label]="'Zone ' + zone.name + ', score ' + zone.global_score + ' sur 100'"
              >
                <div class="flex items-center gap-4">
                  <!-- Rang -->
                  <span class="text-xs font-bold text-gray-300 w-5 text-center shrink-0">
                    {{ rank + 1 }}
                  </span>

                  <!-- Score badge -->
                  <div
                    class="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 text-white"
                    [style.background]="zoneColor(zone)"
                  >
                    @if (zone.score_visibility === 'visible') {
                      <span class="text-xl font-bold leading-none">{{ zone.global_score | number:'1.0-0' }}</span>
                      <span class="text-xs opacity-80">/100</span>
                    } @else {
                      <span class="text-lg">—</span>
                    }
                  </div>

                  <!-- Infos -->
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold text-gray-900 truncate">{{ zone.name }}</p>
                    @if (zone.trend_label) {
                      <p class="text-xs text-gray-400 capitalize mt-0.5">{{ zone.trend_label }}</p>
                    }
                  </div>

                  <!-- Delta -->
                  @if (zone.score_visibility === 'visible') {
                    <div class="text-right shrink-0">
                      <span
                        class="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full"
                        [class]="zone.delta >= 0
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'"
                      >
                        {{ zone.delta >= 0 ? '+' : '' }}{{ zone.delta | number:'1.0-1' }} pts
                      </span>
                    </div>
                  }
                </div>
              </article>
            </li>
          }
        </ol>
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalOpportunitiesComponent {
  private readonly http = inject(HttpClient);
  private readonly mapService = inject(MapService);

  readonly scoreTypes = SCORE_TYPES;
  readonly periods = PERIODS;

  readonly showSuggestions = signal(false);
  readonly selectedPlace = signal<GeocodingResult | null>(null);

  readonly filterModel = signal({ search: '', scoreType: 'prospection_locale', period: '12m' });
  readonly filterForm = form(this.filterModel, (s) => {
    debounce(s.search, 300);
  });

  readonly hasSuggestions = computed(() => this.suggestions.value().results.length > 0);

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
    stream: ({ params }) => {
      const p = new URLSearchParams({
        territory_code: params.territoryCode,
        score_type: params.scoreType,
        period: params.period,
        limit: '30',
      });
      return this.http.get<RisingZonesResponse>(`/api/zones/rising?${p}`);
    },
    defaultValue: EMPTY_RESPONSE,
  });

  readonly zones = computed(() => this.zonesResource.value().zones);

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
  }

  zoneColor(zone: RisingZonesResponse['zones'][number]): string {
    if (zone.score_visibility !== 'visible') return '#94a3b8';
    return scoreColor(zone.global_score);
  }
}
