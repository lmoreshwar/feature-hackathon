import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import {
  ApiOutline,
  ArrowDownOutline,
  ArrowUpOutline,
  DashboardOutline,
  DeleteOutline,
  DownOutline,
  ExperimentOutline,
  LockOutline,
  LoginOutline,
  LogoutOutline,
  MailOutline,
  MenuFoldOutline,
  MenuUnfoldOutline,
  ReloadOutline,
  SearchOutline,
  SettingOutline,
  TeamOutline,
  ThunderboltOutline,
  UserOutline,
  WarningOutline,
} from '@ant-design/icons-angular/icons';

import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

const NZ_ICONS = [
  ApiOutline,
  ArrowDownOutline,
  ArrowUpOutline,
  DashboardOutline,
  DeleteOutline,
  DownOutline,
  ExperimentOutline,
  LockOutline,
  LoginOutline,
  LogoutOutline,
  MailOutline,
  MenuFoldOutline,
  MenuUnfoldOutline,
  ReloadOutline,
  SearchOutline,
  SettingOutline,
  TeamOutline,
  ThunderboltOutline,
  UserOutline,
  WarningOutline,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimations(),
    provideNzI18n(en_US),
    importProvidersFrom(NzIconModule.forRoot(NZ_ICONS), NzModalModule),
  ],
};
