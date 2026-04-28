import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';

import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NzIconModule, NzButtonModule, NzAvatarModule, NzDropDownModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  @Input() collapsed = false;
  @Output() readonly collapsedChange = new EventEmitter<boolean>();

  private readonly authService = inject(AuthService);
  private readonly modal = inject(NzModalService);

  protected readonly currentUser = this.authService.currentUser;

  protected toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed);
  }

  protected confirmLogout(): void {
    this.modal.confirm({
      nzTitle: 'Sign out',
      nzContent: 'Are you sure you want to sign out of the console?',
      nzOkText: 'Sign out',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => this.authService.logout().subscribe(),
    });
  }

  protected initials(email: string | undefined | null): string {
    if (!email) {
      return '?';
    }
    const trimmed = email.trim();
    return trimmed.charAt(0).toUpperCase();
  }
}
