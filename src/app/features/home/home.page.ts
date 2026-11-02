import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-home-page',
  template: `
    <h1 i18n="Home page heading@@home.welcome">Welcome to SimpliaDz</h1>
    <p i18n="Home page introduction@@home.introduction">
      The frontend foundation is ready. The next slice will establish authentication.
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {}
