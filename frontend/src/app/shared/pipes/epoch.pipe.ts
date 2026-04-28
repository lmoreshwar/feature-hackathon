import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'epoch',
  standalone: true,
})
export class EpochPipe implements PipeTransform {
  private readonly datePipe = new DatePipe('en-US');

  transform(
    value: number | string | null | undefined,
    format = 'medium',
  ): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const ms = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(ms)) {
      return null;
    }
    return this.datePipe.transform(new Date(ms), format);
  }
}
