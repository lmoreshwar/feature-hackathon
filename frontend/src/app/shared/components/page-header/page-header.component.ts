import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="page-header">
      <div class="page-header__text">
        <h2>{{ title }}</h2>
        @if (subtitle) {
          <p>{{ subtitle }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin: 0 0 20px;
      }
      .page-header__text h2 {
        margin: 0 0 4px;
        font-size: 22px;
        font-weight: 600;
        color: #1f2d3d;
      }
      .page-header__text p {
        margin: 0;
        color: rgba(0, 0, 0, 0.55);
      }
      .page-header__actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}
