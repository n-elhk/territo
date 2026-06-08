import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import * as d3 from 'd3';
import { MapService } from './map.service';

const SUB_SCORE_LABELS: Record<string, string> = {
  renovation_need: 'Besoin rénovation',
  work_signals: 'Signaux travaux',
  trade_fit: 'Adéquation métier',
  dvf_dynamics: 'Dynamique DVF',
  construction_permits: 'Permis construire',
  urban_density: 'Densité urbaine',
  price_growth: 'Hausse des prix',
  supply_demand: 'Offre/demande',
  market_liquidity: 'Liquidité',
  buyer_demand: 'Demande acquéreur',
  commercial_risk: 'Risque commercial',
};

function scoreColor(score: number): string {
  if (score >= 88) return '#22c55e';
  if (score >= 72) return '#84cc16';
  if (score >= 55) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

interface LinePoint {
  label: string;
  cx: number;
  cy: number;
}

@Component({
  selector: 'app-map-zone-detail',
  imports: [DecimalPipe],
  host: { class: 'flex flex-col overflow-y-auto flex-1' },
  template: `
    <!-- Header -->
    <div
      class="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0"
    >
      <button
        type="button"
        (click)="back.emit()"
        class="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
        aria-label="Retour à la liste"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <span class="text-sm font-semibold text-gray-800 truncate">
        {{ detailResource.value()?.zone?.name ?? '…' }}
      </span>
    </div>

    @if (detailResource.isLoading()) {
      <div class="p-4 space-y-3 animate-pulse">
        <div class="h-16 bg-gray-100 rounded-xl"></div>
        <div class="h-40 bg-gray-100 rounded-xl"></div>
        <div class="h-32 bg-gray-100 rounded-xl"></div>
      </div>
    } @else if (detailResource.value(); as d) {
      <!-- Score principal -->
      <div
        class="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center gap-3"
      >
        <div
          class="w-16 h-16 rounded-xl flex flex-col items-center justify-center text-white shrink-0"
          [style.background]="badgeColor()"
        >
          @if (d.score_visibility === 'visible') {
            <span class="text-2xl font-bold leading-none">{{
              d.global_score | number: '1.0-0'
            }}</span>
            <span class="text-xs opacity-75">/100</span>
          } @else {
            <span class="text-xl">—</span>
          }
        </div>
        <div class="min-w-0">
          <p class="text-xs text-gray-400">{{ scoreTypeLabel() }}</p>
          @if (d.trend.label) {
            <p class="text-sm font-medium text-gray-700 capitalize mt-0.5">
              {{ d.trend.label }}
            </p>
          }
          @if (d.trend.delta_previous_period !== null) {
            <p
              class="text-xs mt-0.5"
              [class]="
                d.trend.delta_previous_period >= 0
                  ? 'text-green-600'
                  : 'text-red-500'
              "
            >
              {{ d.trend.delta_previous_period >= 0 ? '+' : ''
              }}{{ d.trend.delta_previous_period | number: '1.0-1' }} pts
            </p>
          }
        </div>
      </div>

      <!-- Sous-scores -->
      @if (subScoreBars().length > 0) {
        <div class="px-4 pt-4 shrink-0">
          <p
            class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3"
          >
            Sous-scores
          </p>
          <div class="space-y-2">
            @for (bar of subScoreBars(); track bar.name) {
              <div>
                <div class="flex justify-between mb-0.5">
                  <span class="text-xs text-gray-500 truncate max-w-[170px]">{{
                    bar.name
                  }}</span>
                  <span class="text-xs font-semibold text-gray-700">{{
                    bar.value
                  }}</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    [style.width.%]="bar.value"
                    [style.background]="scoreColor(bar.value)"
                  ></div>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Historique SVG -->
      @if (linePoints().length >= 2) {
        <div class="px-4 pt-4 shrink-0">
          <p
            class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
          >
            Historique
          </p>
          <svg
            viewBox="0 0 280 120"
            class="w-full"
            aria-label="Courbe d'historique du score"
            role="img"
          >
            @for (yVal of [25, 50, 75]; track yVal) {
              <line
                x1="0"
                [attr.y1]="yScale()(yVal)"
                x2="280"
                [attr.y2]="yScale()(yVal)"
                stroke="#f3f4f6"
                stroke-width="1"
              />
            }
            <path [attr.d]="areaPath()" fill="#6366f1" fill-opacity="0.08" />
            <path
              [attr.d]="linePath()"
              fill="none"
              stroke="#6366f1"
              stroke-width="2"
              stroke-linecap="round"
            />
            @for (pt of linePoints(); track pt.label) {
              <circle
                [attr.cx]="pt.cx"
                [attr.cy]="pt.cy"
                r="3"
                fill="#6366f1"
              />
            }
            @for (
              pt of linePoints();
              track pt.label;
              let first = $first;
              let last = $last
            ) {
              @if (first || last) {
                <text
                  [attr.x]="pt.cx"
                  y="118"
                  text-anchor="middle"
                  fill="#9ca3af"
                  font-size="9"
                >
                  {{ pt.label }}
                </text>
              }
            }
          </svg>
        </div>
      }

      <!-- Facteurs clés -->
      @if (d.explanation.length > 0) {
        <div class="px-4 pt-4 pb-4 shrink-0">
          <p
            class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
          >
            Facteurs clés
          </p>
          <ul class="space-y-1.5">
            @for (exp of d.explanation; track exp) {
              <li class="text-xs text-gray-600 flex gap-1.5">
                <span class="text-indigo-400 shrink-0 mt-0.5">·</span>{{ exp }}
              </li>
            }
          </ul>
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapZoneDetailComponent {
  private readonly mapService = inject(MapService);

  readonly zoneId = input.required<string>();
  readonly scoreType = input.required<string>();
  readonly period = input.required<string>();
  readonly scoreTypeLabel = input('');

  readonly back = output<void>();

  readonly detailResource = rxResource({
    params: () => ({
      id: this.zoneId(),
      scoreType: this.scoreType(),
      period: this.period(),
    }),
    stream: ({ params }) =>
      this.mapService.getZoneDetail(params.id, params.scoreType, params.period),
  });

  readonly historyResource = rxResource({
    params: () => ({
      id: this.zoneId(),
      scoreType: this.scoreType(),
      period: this.period(),
    }),
    stream: ({ params }) =>
      this.mapService.getZoneHistory(
        params.id,
        params.scoreType,
        params.period,
      ),
  });

  readonly scoreColor = scoreColor;

  readonly subScoreBars = computed(() => {
    const d = this.detailResource.value();
    if (!d) return [];
    return Object.entries(d.sub_scores)
      .map(([key, val]) => ({
        name: SUB_SCORE_LABELS[key] ?? key,
        value: Math.round(val),
      }))
      .sort((a, b) => b.value - a.value);
  });

  readonly rawSeries = computed(() => {
    const h = this.historyResource.value();
    if (!h) return [];
    return h.series.map((pt) => ({
      label: new Date(pt.date).toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      }),
      value: Math.round(pt.global_score),
    }));
  });

  readonly yScale = computed(() => {
    const vals = this.rawSeries().map((p) => p.value);
    if (!vals.length) return d3.scaleLinear().domain([0, 100]).range([108, 4]);
    const lo = Math.max(0, Math.min(...vals) - 10);
    const hi = Math.min(100, Math.max(...vals) + 10);
    return d3.scaleLinear().domain([lo, hi]).range([108, 4]);
  });

  readonly xScale = computed(() =>
    d3
      .scalePoint<string>()
      .domain(this.rawSeries().map((p) => p.label))
      .range([8, 272])
      .padding(0.1),
  );

  readonly linePoints = computed((): LinePoint[] => {
    const x = this.xScale();
    const y = this.yScale();
    return this.rawSeries().map((p) => ({
      label: p.label,
      cx: x(p.label) ?? 0,
      cy: y(p.value),
    }));
  });

  readonly linePath = computed(() => {
    const pts = this.linePoints();
    if (pts.length < 2) return '';
    return (
      d3
        .line<LinePoint>()
        .x((p) => p.cx)
        .y((p) => p.cy)
        .curve(d3.curveCatmullRom)(pts) ?? ''
    );
  });

  readonly areaPath = computed(() => {
    const pts = this.linePoints();
    if (pts.length < 2) return '';
    return (
      d3
        .area<LinePoint>()
        .x((p) => p.cx)
        .y0(108)
        .y1((p) => p.cy)
        .curve(d3.curveCatmullRom)(pts) ?? ''
    );
  });

  readonly badgeColor = computed(() => {
    const d = this.detailResource.value();
    if (!d || d.score_visibility !== 'visible') return '#94a3b8';
    return scoreColor(d.global_score);
  });
}
