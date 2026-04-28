import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { statusColor } from '../../utils/status-color.util';

@Component({
  selector: 'app-status-tag',
  standalone: true,
  imports: [NzTagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-tag [nzColor]="color">{{ label }}</nz-tag>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      nz-tag {
        font-weight: 500;
        letter-spacing: 0.02em;
      }
    `,
  ],
})
export class StatusTagComponent {
  @Input({ required: true }) status!: string;
  @Input() labelOverride?: string;

  protected get color(): string {
    return statusColor(this.status);
  }

  protected get label(): string {
    return this.labelOverride ?? this.status?.replace(/_/g, ' ') ?? '';
  }
}
