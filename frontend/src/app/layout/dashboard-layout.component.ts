import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subject, fromEvent, takeUntil } from 'rxjs';

import { NzLayoutModule } from 'ng-zorro-antd/layout';

import { AuthService } from '../core/auth/auth.service';
import { HeaderComponent } from './header.component';
import { SidebarComponent } from './sidebar.component';

const MOBILE_BREAKPOINT_PX = 768;

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [NzLayoutModule, RouterOutlet, SidebarComponent, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  protected readonly collapsed = signal<boolean>(this.isMobileViewport());

  ngOnInit(): void {
    this.authService.loadProfile().subscribe();

    if (typeof window !== 'undefined') {
      fromEvent(window, 'resize')
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (this.isMobileViewport() && !this.collapsed()) {
            this.collapsed.set(true);
          }
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected setCollapsed(value: boolean): void {
    this.collapsed.set(value);
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth < MOBILE_BREAKPOINT_PX;
  }
}
