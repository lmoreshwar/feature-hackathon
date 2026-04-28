import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { AuthService } from '../../core/auth/auth.service';

interface StatCard {
  title: string;
  value: number;
  icon: string;
  color: string;
  delta: string;
  trend: 'up' | 'down';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NzCardModule, NzGridModule, NzStatisticModule, NzIconModule, NzTagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);

  protected readonly currentUser = this.authService.currentUser;

  protected readonly stats: StatCard[] = [
    { title: 'Active users', value: 1284, icon: 'team', color: '#1677ff', delta: '+8.4%', trend: 'up' },
    { title: 'Active sessions', value: 327, icon: 'thunderbolt', color: '#52c41a', delta: '+2.1%', trend: 'up' },
    { title: 'API requests (24h)', value: 48235, icon: 'api', color: '#fa8c16', delta: '-1.8%', trend: 'down' },
    { title: 'Errors (24h)', value: 12, icon: 'warning', color: '#ff4d4f', delta: '-37.5%', trend: 'down' },
  ];
}
