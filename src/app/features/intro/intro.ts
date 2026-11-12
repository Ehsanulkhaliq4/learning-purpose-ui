import { Component } from '@angular/core';
import { AuthDialogService } from '../../core/services/auth-dialog.service';

@Component({
  selector: 'app-intro',
  templateUrl: './intro.html',
  styleUrl: './intro.css',
})
export class Intro {
  constructor(readonly authDialogService: AuthDialogService) {}
}
