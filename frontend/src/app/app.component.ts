import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root application shell — provides the router outlet.
 * All page content is rendered through Angular routing.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent {
  title = 'wigma';
}
