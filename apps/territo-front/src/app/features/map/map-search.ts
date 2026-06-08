import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import type { GeocodingResult, GeocodingSearchResponse } from '@territo/schemas';

@Component({
  selector: 'app-map-search',
  template: `
    <div class="relative" (focusout)="onBlur($event)">
      <input
        type="search"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="searchChange.emit($any($event.target).value)"
        (focus)="showDropdown.set(true)"
        class="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        [attr.aria-label]="placeholder()"
        aria-autocomplete="list"
        aria-controls="commune-suggestions"
        [attr.aria-expanded]="showDropdown() && hasSuggestions()"
      />
      @if (showDropdown() && hasSuggestions()) {
        <ul
          id="commune-suggestions"
          role="listbox"
          class="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          @for (item of suggestions().results; track item.commune_code) {
            <li
              role="option"
              [attr.aria-selected]="false"
              class="px-4 py-2.5 text-sm hover:bg-indigo-50 cursor-pointer"
              (mousedown)="select(item)"
            >
              <span class="font-medium text-gray-800">{{ item.label }}</span>
              <span class="text-gray-400 ml-2 text-xs">{{ item.commune }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapSearchComponent {
  readonly value = input<string>('');
  readonly suggestions = input.required<GeocodingSearchResponse>();
  readonly placeholder = input('Rechercher une commune…');

  readonly searchChange = output<string>();
  readonly placeSelected = output<GeocodingResult>();

  readonly showDropdown = signal(false);
  readonly hasSuggestions = computed(() => this.suggestions().results.length > 0);

  onBlur(event: FocusEvent) {
    const related = event.relatedTarget as HTMLElement | null;
    if (!related?.closest('#commune-suggestions')) this.showDropdown.set(false);
  }

  select(place: GeocodingResult) {
    this.showDropdown.set(false);
    this.placeSelected.emit(place);
  }
}
