import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { initWasmMath } from './app/shared/math/wasm-math';

// Initialize WASM math module before bootstrapping the Angular app
initWasmMath()
  .then(() => bootstrapApplication(AppComponent, appConfig))
  .catch((err) => console.error(err));
