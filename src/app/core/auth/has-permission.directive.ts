import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { AuthSessionService } from './auth-session.service';

/**
 * Renders its host template only when the signed-in user holds every listed permission.
 * UX only; the API remains the authority.
 *
 * Usage: `<button *appHasPermission="'products.edit'">Edit</button>`
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private readonly session = inject(AuthSessionService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  readonly appHasPermission = input.required<string | readonly string[]>();

  private readonly required = computed(() => {
    const value = this.appHasPermission();
    return typeof value === 'string' ? [value] : value;
  });

  constructor() {
    effect(() => {
      const allowed = this.session.hasAllPermissions(this.required());
      this.viewContainer.clear();

      if (allowed) {
        this.viewContainer.createEmbeddedView(this.template);
      }
    });
  }
}
