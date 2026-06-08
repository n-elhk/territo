import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { ZoneProperties } from '@territo/schemas';

export type ZoneListItem = ZoneProperties & { trend_label?: string | null };

function scoreColor(score: number, visibility: string): string {
  if (visibility !== 'visible') return '#94a3b8';
  if (score >= 88) return '#22c55e';
  if (score >= 72) return '#84cc16';
  if (score >= 55) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

@Component({
  selector: 'app-map-zone-list',
  imports: [DecimalPipe],
  host: { class: 'flex flex-col overflow-hidden flex-1' },
  template: `
    <div class="px-3 py-2 border-b border-gray-100 shrink-0">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {{ zones().length }} zones
      </p>
    </div>

    <ol class="overflow-y-auto flex-1" aria-label="Zones classées par score">
      @for (zone of zones(); track zone.zone_id; let i = $index) {
        <li>
          <button
            type="button"
            class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-indigo-50 transition border-b border-gray-50"
            (click)="zoneSelected.emit(zone.zone_id)"
            [attr.aria-label]="'Voir le détail de ' + zone.name"
          >
            <span class="text-xs text-gray-300 w-4 shrink-0 text-right">{{
              i + 1
            }}</span>
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              [style.background]="
                color(zone.global_score, zone.score_visibility)
              "
            >
              @if (zone.score_visibility === 'visible') {
                {{ zone.global_score | number: '1.0-0' }}
              } @else {
                —
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">
                {{ zone.name }}
              </p>
              @if (zone.trend_label) {
                <p class="text-xs text-gray-400 capitalize">
                  {{ zone.trend_label }}
                </p>
              }
            </div>
            <svg
              class="w-4 h-4 text-gray-300 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </li>
      }
    </ol>

  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapZoneListComponent {
  readonly zones = input.required<ZoneListItem[]>();
  readonly zoneSelected = output<string>();

  readonly color = scoreColor;
}
