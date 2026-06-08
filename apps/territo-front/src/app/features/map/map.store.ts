import { computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import type { GeocodingResult } from '@territo/schemas';
import { SCORE_TYPES } from './map.constants';

const SCORE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SCORE_TYPES.map((s) => [s.value, s.label]),
);

interface MapState {
  searchRaw: string;
  search: string;
  scoreType: string;
  period: string;
  selectedPlace: GeocodingResult | null;
  selectedZoneId: string | null;
  leftPanelOpen: boolean;
}

const initialState: MapState = {
  searchRaw: '',
  search: '',
  scoreType: 'prospection_locale',
  period: '12m',
  selectedPlace: null,
  selectedZoneId: null,
  leftPanelOpen: true,
};

export const MapStore = signalStore(
  withState(initialState),
  withProps(() => ({ _search$: new Subject<string>() })),
  withComputed(({ selectedPlace, selectedZoneId, scoreType, period }) => ({
    mapCenter: computed<[number, number]>(() => {
      const p = selectedPlace();
      return p ? [p.lng, p.lat] : [2.3522, 46.8];
    }),
    mapZoom: computed<[number]>(() => (selectedPlace() ? [13] : [5.5])),
    scoreTypeLabel: computed(() => SCORE_TYPE_LABELS[scoreType()] ?? ''),
    selectedZoneFilter: computed(() =>
      selectedZoneId()
        ? ['==', ['get', 'zone_id'], selectedZoneId()]
        : ['==', ['get', 'zone_id'], ''],
    ),
    filterParams: computed(() => {
      const place = selectedPlace();
      if (!place) return undefined;
      return { territoryCode: place.commune_code, scoreType: scoreType(), period: period() };
    }),
  })),
  withMethods((store) => ({
    typeSearch(raw: string): void {
      patchState(store, { searchRaw: raw });
      store._search$.next(raw);
    },
    setScoreType(scoreType: string): void {
      patchState(store, { scoreType });
    },
    setPeriod(period: string): void {
      patchState(store, { period });
    },
    selectPlace(place: GeocodingResult): void {
      patchState(store, {
        selectedPlace: place,
        searchRaw: place.label,
        search: place.label,
        selectedZoneId: null,
      });
    },
    selectZone(selectedZoneId: string): void {
      patchState(store, { selectedZoneId });
    },
    clearZone(): void {
      patchState(store, { selectedZoneId: null });
    },
    setLeftPanel(leftPanelOpen: boolean): void {
      patchState(store, { leftPanelOpen });
    },
  })),
  withHooks((store) => {
    const destroyRef = inject(DestroyRef);
    return {
      onInit() {
        store._search$.pipe(
          debounceTime(300),
          takeUntilDestroyed(destroyRef),
        ).subscribe((search) => patchState(store, { search }));
      },
    };
  }),
);
