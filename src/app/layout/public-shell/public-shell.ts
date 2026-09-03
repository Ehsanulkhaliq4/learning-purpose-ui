import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-public-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './public-shell.html',
  styleUrl: './public-shell.css',
})
export class PublicShell {}
