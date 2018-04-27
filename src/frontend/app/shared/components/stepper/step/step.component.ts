import 'rxjs/add/observable/of';

import { Component, Input, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs/Observable';

export interface IStepperStep {
  validate: Observable<boolean>;
  onNext: StepOnNextFunction;
  onEnter?: () => void;
}

export type StepOnNextFunction = () => Observable<{
  success: boolean,
  message?: string,
  // Should we redirect to the store previous state?
  redirect?: boolean
}>;

@Component({
  selector: 'app-step',
  templateUrl: './step.component.html',
  styleUrls: ['./step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class StepComponent implements OnInit {

  public _onEnter: () => void;
  active = false;
  complete = false;
  error = false;
  busy = false;

  @Input()
  title: string;

  @Input('valid')
  valid = true;

  @Input('canClose')
  canClose = true;

  @Input('nextButtonText')
  nextButtonText = 'Next';

  @Input('finishButtonText')
  finishButtonText = 'Finish';

  @Input('cancelButtonText')
  cancelButtonText = 'Cancel';

  @Input('disablePrevious')
  disablePrevious = false;

  @Input('blocked$')
  blocked$: Observable<boolean>;

  @Input('distructiveStep')
  public distructiveStep = false;

  @ViewChild(TemplateRef)
  content: TemplateRef<any>;

  @Input()
  onNext: StepOnNextFunction = () => Observable.of({ success: true })

  @Input()
  onEnter: () => void = () => { }

  constructor() {
    this._onEnter = () => {
      if (this.distructiveStep) {
        this.busy = true;
        setTimeout(() => {
          this.busy = false;
        }, 3000);
      }
      this.onEnter();
    };
  }

  ngOnInit() {
  }

}
