import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'projects',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/projects/project-list.component').then(m => m.ProjectListComponent),
  },
  {
    path: 'project/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/editor/editor-shell.component').then(m => m.EditorShellComponent),
  },
  {
    path: '**',
    redirectTo: 'projects',
  },
];
