[![REUSE status](https://api.reuse.software/badge/github.com/SAP-samples/smb-eats-backend)](https://api.reuse.software/info/github.com/SAP-samples/smb-eats-backend)
[![License: Apache2](https://img.shields.io/badge/License-Apache2-green.svg)](https://opensource.org/licenses/Apache-2.0)
# Put the collaboration in business context with SAP Workflow Service and Microsoft Teams

[![](https://i.imgur.com/mq8j0Vs.png "launch live demo")](https://smb-eats.cfapps.eu10.hana.ondemand.com)

## Description
This is a sample application to demonstrate how partners can create solutions with SAP Workflow Service, and integration with Microsoft Teams, extending or adapting the business process in backend ERP (in this case SAP Business ByDesign) to achieve business process agility and intuitive collaboration.<br>
🔴 [Live Demo](https://workflow-msteams-approval.cfapps.eu10.hana.ondemand.com/)
📄 [Blog with details](https://blogs.sap.com/2021/02/25/put-collaboration-in-business-context-with-sap-workflow-service-and-ms-teams/)

This sample(workflow-msteams-approval) implements a custom end-to-end approval process with SAP Workflow Service integration and Microsoft Teams for SAP Business ByDesign. The showcase scenario is that employee needs a shared fixed asset (car, toolset, etc.) to perform some task, he/she requests an asset from Microsoft Teams Custom App, kicking off the workflow process in SAP Workflow Service. Upon the approval, a fixed asset organizational assignment will be created in SAP Business ByDesign for management accounting, where the depreciation of the asset is allocated to requestor’s cost center for the requested date range. Such process is handled by the [Workflow Management Service](https://discovery-center.cloud.sap/serviceCatalog/workflow-management).

![worfklow process](https://i.imgur.com/mRTGHSO.png "Workflow process on the Business Application Studio")

The process starts with an employee who temporarily requires a shared asset to perform some task, submits an asset request from Microsoft Teams Custom App-Request Approval in this repository, which kicks off the workflow process via the [Workflow APIs](https://help.sap.com/viewer/e157c391253b4ecd93647bf232d18a83/Cloud/en-US/df943e71122448caaf3c49f5ffd80627.html).

"Approver" (cost center owner, or line manager etc) reviews, then approve or reject with some remarks within SAP Workflow Inbox.

Once the request is approved, then workflow will post a fixed asset organistional assignment of the requested asset to the given cost center in backend ERP, which is SAP Business ByDesign in this case.

An email will be sent to the employee about request result. 

## Requirements
* [Obtain a free SAP BTP Trial Account](https://developers.sap.com/tutorials/hcp-create-trial-account.html)
* [Set Up SAP Workflow Management in Cloud Cockpit](https://developers.sap.com/tutorials/cp-starter-ibpm-employeeonboarding-1-setup.html)
* [The Service Key Details](https://help.sap.com/viewer/e157c391253b4ecd93647bf232d18a83/Cloud/en-US/e8d88dd056f14c75af59e68d6b20345f.html#loioe8d88dd056f14c75af59e68d6b20345f__create_service_key) of your workflow instance
* [Set up SAP Business Application Studio for Workflow Development](https://developers.sap.com/tutorials/cp-workflow-2-create-module-cf.html). Please just follow Step 1: Set up SAP Business Application Studio
* [Install the Cloud Foundry CLI](https://developers.sap.com/tutorials/cp-cf-download-cli.html)


## Configuration and Deployment
Clone this repository
```sh
git clone https://github.com/SAP-samples/workflow-msteams-approval.git
```
From the root directory of the repository, using the [Cloud Foundry CLI](https://docs.cloudfoundry.org/cf-cli/install-go-cli.html) push your app to the SAP CP Cloud Foundry
```sh
cf push --random-route
```
Enable technical authenticaiotn,and configure the access to your worfklow data via REST api running the following command:
```sh
cf update-service <WF INSTANCE NAME> -c '{"authorities": ["WORKFLOW_DEFINITION_GET", "WORKFLOW_INSTANCE_START", "WORKFLOW_INSTANCE_GET", "TASK_GET", "TASK_GET_CONTEXT", "TASK_COMPLETE", "TASK_UPDATE"]}'
```
*This will allow the sample application to consume [Workflow APIs](https://api.sap.com/api/SAP_CP_Workflow_CF/resource)*

Then set the Environment Variables accordingly
```sh
cf set-env workflow-msteams-approval AUTH_URL <User authentical URL as shown on the Workflow instance secret key>
cf set-env workflow-msteams-approval AUTH_CLIENT_ID '<Client ID as on on the Workflow instance secret key>'
cf set-env workflow-msteams-approval AUTH_CLIENT_SECRET '<Client Secret>'
cf set-env workflow-msteams-approval WF_REST_URL <Workflow REST API URL>
cf set-env workflow-msteams-approval WF_DEFINITION <Your workflow definition ID>
cf set-env workflow-msteams-approval ERP_BASE_URL <The base url of your ByD tenant>
cf set-env workflow-msteams-approval ERP_USER <The ByD User for OData access>
cf set-env workflow-msteams-approval ERP_USER_PASSWORD <The ByD User for OData access>
cf set-env workflow-msteams-approval ERP_CSRF_TOKEN_URL_PATH '/sap/byd/odata/v1/customerincident'
```
**Example**
```sh
cf set-env workflow-msteams-approval AUTH_URL 'https://12345678trial.authentication.eu10.hana.ondemand.com'
cf set-env workflow-msteams-approval AUTH_CLIENT_ID 'sb-clone-12345678-cf1a-this-is-a-dummy-client-id-a5fd4c3bf151!b74274|workflow!b10150'
cf set-env workflow-msteams-approval AUTH_CLIENT_SECRET '<Your Client Secret>'
cf set-env workflow-msteams-approval WF_REST_URL 'https://api.workflow-sap.cfapps.eu10.hana.ondemand.com/workflow-service/rest'
cf set-env workflow-msteams-approval WF_DEFINITION 'xxx_asset_assignment'
cf set-env workflow-msteams-approval ERP_BASE_URL 'https://my12345.sapbydesign.com'
cf set-env workflow-msteams-approval ERP_USER 'Your Business User with Fixed Asset WoC'
cf set-env workflow-msteams-approval ERP_USER_PASSWORD '<Your User Password>'
cf set-env workflow-msteams-approval ERP_CSRF_TOKEN_URL_PATH '/sap/byd/odata/v1/customerincident'
```
Restart your application (so it can read the new environment variables)
```sh
cf restart workflow-msteams-approval
```


## Known Issues

## How to obtain support
This repository is provided "as-is". No offcial support is available. 

[Create an issue](https://github.com/SAP-samples/<repository-name>/issues) in this repository if you find a bug or have questions about the content.
 
For additional support, [ask a question in SAP Community](https://answers.sap.com/questions/ask.html).

## Contributing
Feel free to open issues or provide pull requests.

## License
Copyright (c) 2021 SAP SE or an SAP affiliate company. All rights reserved. This project is licensed under the Apache Software License, version 2.0 except as noted otherwise in the [LICENSE](LICENSES/Apache-2.0.txt) file.
