import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NzMenuModule, NzIconModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() collapsed = false;

  protected readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Features', icon: 'appstore', route: '/features' },
    { label: 'Test Suites', icon: 'folder', route: '/test-suites' },
    { label: 'Requirements', icon: 'file-text', route: '/requirements' },
    { label: 'Test Cases', icon: 'check-square', route: '/test-cases' },
    { label: 'Coverage Review', icon: 'audit', route: '/coverage-review' },
    { label: 'Page Crawl', icon: 'global', route: '/page-elements' },
    { label: 'Mappings', icon: 'partition', route: '/mappings' },
    { label: 'Executions', icon: 'thunderbolt', route: '/executions' },
    { label: 'Traceability', icon: 'cluster', route: '/traceability' },
    { label: 'Integrations', icon: 'api', route: '/integrations' },
    { label: 'Users', icon: 'team', route: '/users' },
  ];
}
