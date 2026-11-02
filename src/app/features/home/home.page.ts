import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-home-page',
  template: `<h1>Welcome to SimpliaDz</h1>
    <p>The frontend foundation is ready. The next slice will establish authentication.</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {}
