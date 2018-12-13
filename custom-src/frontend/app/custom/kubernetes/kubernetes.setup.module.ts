import { NgModule } from '@angular/core';

import { StratosExtension } from '../../core/extension/extension-service';
import { EndpointAuthTypeConfig, EndpointType, EndpointTypeConfig } from '../../core/extension/extension-types';
import { Validators } from '@angular/forms';
import { CoreModule } from '../../core/core.module';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';
import { KubernetesCertsAuthFormComponent } from './auth-forms/kubernetes-certs-auth-form/kubernetes-certs-auth-form.component';
import { KubernetesAWSAuthFormComponent } from './auth-forms/kubernetes-aws-auth-form/kubernetes-aws-auth-form.component';
import { KubernetesConfigAuthFormComponent } from './auth-forms/kubernetes-config-auth-form/kubernetes-config-auth-form.component';

const kubernetesEndpointTypes: EndpointTypeConfig[] = [{
  value: 'k8s',
  label: 'Kubernetes',
  authTypes: [],
  icon: 'kubernetes',
  iconFont: 'stratos-icons',
  homeLink: (guid) => ['/kubernetes', guid]
}];

const kubernetesAuthTypes: EndpointAuthTypeConfig[] = [{
  value: 'kubeconfig',
  name: 'CAASP (OIDC)',
  form: {
    kubeconfig: ['', Validators.required],
  },
  types: new Array<EndpointType>('k8s'),
  component: KubernetesConfigAuthFormComponent
},
{
  value: 'kubeconfig-az',
  name: 'Azure AKS',
  form: {
    kubeconfig: ['', Validators.required],
  },
  types: new Array<EndpointType>('k8s'),
  component: KubernetesConfigAuthFormComponent
},
{
  value: 'aws-iam',
  name: 'AWS IAM (EKS)',
  form: {
    cluster: ['', Validators.required],
    access_key: ['', Validators.required],
    secret_key: ['', Validators.required],
  },
  types: new Array<EndpointType>('k8s'),
  component: KubernetesAWSAuthFormComponent
},
{
  value: 'kube-cert-auth',
  name: 'Kubernetes Cert Auth',
  form: {
    cert: ['', Validators.required],
    certKey: ['', Validators.required],
  },
  types: new Array<EndpointType>('k8s'),
  component: KubernetesCertsAuthFormComponent
}
];


@StratosExtension({
  endpointTypes: kubernetesEndpointTypes,
  authTypes: kubernetesAuthTypes

})
@NgModule({
  imports: [
    CoreModule,
    CommonModule,
    SharedModule,
  ],
  declarations: [
    KubernetesCertsAuthFormComponent,
    KubernetesAWSAuthFormComponent,
    KubernetesConfigAuthFormComponent,
  ],
  entryComponents: [
    KubernetesCertsAuthFormComponent,
    KubernetesAWSAuthFormComponent,
    KubernetesConfigAuthFormComponent,
  ]
})
export class KubernetesSetupModule { }
