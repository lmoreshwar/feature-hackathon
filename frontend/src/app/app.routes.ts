import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { DashboardLayoutComponent } from './layout/dashboard-layout.component';

export const appRoutes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
    title: 'Sign in · Quantum AI',
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/signup/signup.component').then((m) => m.SignupComponent),
    title: 'Create account · Quantum AI',
  },
  {
    path: '',
    component: DashboardLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
        title: 'Dashboard · Quantum AI',
      },
      {
        path: 'features',
        loadComponent: () =>
          import('./pages/features/features.component').then(
            (m) => m.FeaturesComponent,
          ),
        title: 'Features · Quantum AI',
      },
      {
        path: 'features/:featureId',
        loadComponent: () =>
          import('./pages/features/feature-details.component').then(
            (m) => m.FeatureDetailsComponent,
          ),
        title: 'Feature details · Quantum AI',
      },
      {
        path: 'test-suites',
        loadComponent: () =>
          import('./pages/test-suites/test-suites.component').then(
            (m) => m.TestSuitesComponent,
          ),
        title: 'Test suites · Quantum AI',
      },
      {
        path: 'requirements',
        loadComponent: () =>
          import('./pages/requirements/requirements.component').then(
            (m) => m.RequirementsComponent,
          ),
        title: 'Requirement input · Quantum AI',
      },
      {
        path: 'test-cases',
        loadComponent: () =>
          import('./pages/test-cases/test-cases.component').then(
            (m) => m.TestCasesComponent,
          ),
        title: 'Test case review · Quantum AI',
      },
      {
        path: 'page-elements',
        loadComponent: () =>
          import('./pages/page-elements/page-elements.component').then(
            (m) => m.PageElementsComponent,
          ),
        title: 'Page crawl · Quantum AI',
      },
      {
        path: 'mappings',
        loadComponent: () =>
          import('./pages/mappings/mappings.component').then(
            (m) => m.MappingsComponent,
          ),
        title: 'Test case ↔ element mapping · Quantum AI',
      },
      {
        path: 'executions',
        loadComponent: () =>
          import('./pages/executions/executions.component').then(
            (m) => m.ExecutionsComponent,
          ),
        title: 'Build execution · Quantum AI',
      },
      {
        path: 'traceability',
        loadComponent: () =>
          import('./pages/traceability/traceability.component').then(
            (m) => m.TraceabilityComponent,
          ),
        title: 'Traceability · Quantum AI',
      },
      {
        path: 'integrations',
        loadComponent: () =>
          import('./pages/integrations/integrations.component').then(
            (m) => m.IntegrationsComponent,
          ),
        title: 'Settings · Quantum AI',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/users.component').then((m) => m.UsersComponent),
        title: 'Users · Quantum AI',
      },
      // legacy alias for the previous settings page
      { path: 'settings', redirectTo: 'integrations', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
