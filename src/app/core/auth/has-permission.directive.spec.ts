import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSessionService } from './auth-session.service';
import { HasPermissionDirective } from './has-permission.directive';

@Component({
  imports: [HasPermissionDirective],
  template: `
    <button id="single" *appHasPermission="'products.edit'">Edit</button>
    <button id="all" *appHasPermission="['products.edit', 'products.create']">Create</button>
  `,
})
class HostComponent {}

describe('HasPermissionDirective', () => {
  function render(permissions: string[]): HTMLElement {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const session = TestBed.inject(AuthSessionService);
    session.accessToken.set('token');
    session.user.set({ userId: 'u', email: 'a@b.c', roles: [], permissions });

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders only when every required permission is granted', () => {
    const element = render(['products.edit']);

    expect(element.querySelector('#single')).not.toBeNull();
    expect(element.querySelector('#all')).toBeNull();
  });

  it('renders nothing when the permission is missing', () => {
    const element = render([]);

    expect(element.querySelector('#single')).toBeNull();
    expect(element.querySelector('#all')).toBeNull();
  });
});
