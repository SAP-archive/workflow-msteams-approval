const axios = require("axios");

////////////////////////////////////////////////////////////////////////////////////////////////
// Begining of retry machanism for 401/403 erros for axios instance.
/* Original source code: https://gist.github.com/nzvtrk/ebf494441e36200312faf82ce89de9f2
 * Basic example of save cookie using axios in node.js and recreate session if it expired.
 * Get/save cookie manually cause WithCredential axios param use XHR and not work in node.js
 * Supports parallel request and send only one create session request.
 * */

// Init two instances of axios which works with baseURL
// axiosAuthInstance - instance for authentication of BTP workflow service with OAuth 2.0
// axiosWorkflowInstance - instance for accessing the rest api of BTP workflow service.
const axiosAuthInstance = axios.create({ baseURL: process.env.AUTH_URL });
const axiosWorkflowInstance = axios.create({ baseURL: process.env.WF_REST_URL });

//Get access token
const createSession = async () => {
    console.log("Creating OAuth 2.0 session to SAP Workflow.");

    const res = await axiosAuthInstance.request({
        url: "/oauth/token",
        method: "POST",
        auth: {
            username: process.env.AUTH_CLIENT_ID,
            password: process.env.AUTH_CLIENT_SECRET
        },
        params: {
            "grant_type": "client_credentials"
        }
    });

    console.log("SAP Workflow Oauth Token retrieved Succesfully!");
    const authorization = `Bearer ${res.data.access_token}`;
    axiosWorkflowInstance.defaults.headers.common['Authorization'] = authorization;

    let context = {};
    context.authorization = authorization;

    return context; // return Promise<context> cause func is async
};

let isGetActiveSessionRequest = false;
let requestQueue = [];

const callRequestsFromQueue = context => {
    requestQueue.forEach(sub => sub(context));
};
const addRequestToQueue = sub => {
    requestQueue.push(sub);
};
const clearQueue = () => {
    requestQueue = [];
};

//register axios interceptor which handles responses errors
//For 401(unauthorised)/403(forbidden) errors due to unauthorised session or session timeout
//creating the session and retry the request with the new session.
axiosWorkflowInstance.interceptors.response.use(null, error => {
    console.error(error.message);

    const { response = {}, config: sourceConfig } = error;

    // check if request failed cause Unauthorized or forbidden
    if (response.status === 401 || response.status === 403) {
        console.log("The error is due to unauthorized or oauth session expired for SAP workflow. \nWe'll create a new session and retry the request.");
        // if this request is first we set isGetActiveSessionRequest flag to true and run createSession
        if (!isGetActiveSessionRequest) {
            isGetActiveSessionRequest = true;
            createSession().then(context => {
                // when createSession resolve with cookie value we run all request from queue with new cookie
                isGetActiveSessionRequest = false;
                callRequestsFromQueue(context);
                clearQueue(); // and clean queue
            }).catch(e => {
                isGetActiveSessionRequest = false; // Very important!
                console.error('Create session error: %s', e.message);
                clearQueue();
            });
        }

        // and while isGetActiveSessionRequest equal true we create and return new promise
        const retryRequest = new Promise(resolve => {
            // we push new function to queue
            addRequestToQueue(context => {
                // function takes one param 'cookie'
                console.log("Retry with new session context %s SAP Worflow REST request to %s", sourceConfig.method, sourceConfig.url);

                //******************************************************************************************/
                // Option 1: Setup the required headers: cookie,token and authorization, reintialise
                // an request with axios(sourceConfig)
                //******************************************************************************************/
                sourceConfig.headers.Authorization = context.authorization;
                resolve(axios(sourceConfig)); // and resolve promise with axios request by old config with cookie
                // we resolve exactly axios request - NOT axiosInstance request cause it could call recursion

                //******************************************************************************************/
                // Option 2: Retry the request with axiosInstance with initalised session context
                // Since the new session has been created, the session context has been initialized to axioInstance
                // the easiest way is to retry the request with axiosInstance and the orginal request config-sourceConfig
                // It might causse endless recursion if it is due to wrong credentials.
                // Therefore, please assure the correct credentials, otherwise, you may think of implment the 
                // maximum retries.
                //******************************************************************************************/
                //resolve(axiosWorkflowInstance.request(sourceConfig));
            });
        });

        return retryRequest;
    } else {
        // if error is not related with Unauthorized we reject promise
        return Promise.reject(error);
    }
});
// End of retry machanism for 401/403 erros for axios instance.
////////////////////////////////////////////////////////////////

exports.StartInstance = (context) => {
    //Starts the Workflow Instance. The beggining of the process
    return new Promise((resolve, reject) => {
        const data = {
            definitionId: process.env.WF_DEFINITION,
            context: context
        }

        axiosWorkflowInstance.request({
            url: "/v1/workflow-instances",
            method: "POST",
            data: data
        }).then((res) => {
            console.log("Worflow Instance " + res.data.id + " Created Successfully");
            resolve(res.data);
        }).catch((err) => {
            reject(err);
        });
    })
}

//https://api.workflow-sap.cfapps.eu10.hana.ondemand.com/workflow-service/rest/v1/workflow-instances?$expand=attributes&attributes.requestBy=yatsealee@gmail.com
exports.GetInstancesByAttribute = (attributeFilter) => {
    //Fetch all workflow instance with the given attributeFilter
    //prerequisites as custom attributes have been defined in the workflow.
    //api reference: https://api.sap.com/api/SAP_CP_Workflow_CF/resource?tag=Workflow%20Instances&path=get_v1_workflow_instances__workflowInstanceId__attributes&method=get&opId=get_v1_workflow_instances__workflowInstanceId__attributes
    return new Promise((resolve, reject) => {
        let expand = "attributes";
        if (attributeFilter) {
            expand = `${expand}&${attributeFilter}`;
        }

        console.log("Retrieving workflow instances with attribute filter: %s", attributeFilter);
        axiosWorkflowInstance.request({
            url: `/v1/workflow-instances?$expand=${expand}`,
            method: "GET",
            // params: {
            //     "$expand": expand
            // }
        }).then((res) => {
            let instances = res.data;
            console.log("%d Workflow instances retrieved with attribute filter: %s", instances.length, attributeFilter);
            
            resolve(instances);
        }).catch((err) => {
            reject(err);
        });
    })
}

exports.GetTasks = (user) => {
    //Fetch all open (READY) task instances for a given activity(id)
    return new Promise((resolve, reject) => {
        const activityId = convertUserToActivity(user)
        if (!activityId) {
            reject("Invalid User - " + user)
        } else {
            console.log("Retrieving Tasks from Workflow for User " + user)
            axiosWorkflowInstance.request({
                url: "/v1/task-instances",
                method: "GET",
                params: {
                    "status": "READY",
                    "activityId": activityId
                }
            }).then((res) => {
                var tasks = res.data;

                console.log(tasks.length + " Tasks open for user " + user);
                console.log("Retrieving Context for each task");

                var getTaskContext = [];
                tasks.forEach(task => {
                    getTaskContext.push(GetTaskContext(task));
                })

                Promise.all(getTaskContext).then((newdata) => {
                    resolve(newdata);
                });;
            }).catch((err) => {
                reject(err);
            });
        }
    })
}

exports.GetOpenTaskOnInstance = function (instanceID) {
    //Fetch all open (READY) task instances for a given workflow(id)
    //This should be the last task (Rider going to deliver)
    return new Promise(function (resolve, reject) {
        console.log("Retrieving Open task on Worfklow Instance " + instanceID)
        axiosWorkflowInstance.request({
            url: "/v1/task-instances",
            method: "GET",
            params: {
                //"status": "READY",
                "workflowInstanceId": instanceID
            }
        }).then((res) => {
            console.log("Found " + res.data.length + " Open tasks on WF instance " + instanceID)
            if (res.data.length == 0) {
                console.log("RETRYING!!");
                resolve(GetOpenTaskOnInstance(instanceID));
            } else {
                resolve(res.data);
            }
            resolve(res.data);
        }).catch((err) => {
            reject(err);
        });
    })

}

exports.GetTaskContext = function (task) {
    //fetch the context (user data) of a task (retrieved by GetTasks)
    //In this case, name, address, etc..
    return new Promise(function (resolve, reject) {

        var taskDetails;
        var taskId;

        if (task.id) {
            taskDetails = task;
            taskId = task.id
        } else {
            if (task) {
                taskId = task
            } else {
                reject("Invalid Task ID - " + task.id)
                return
            }
        }
        axiosWorkflowInstance.request({
            url: "/v1/task-instances/" + taskId + "/context",
            method: "GET"
        }).then((res) => {
            console.log("Context retrievd for task " + taskId)
            var newData = {};
            if (taskDetails) {
                newData = taskDetails;
            }
            newData.context = res.data;
            resolve(newData);
        }).catch((err) => {
            reject(err);
        });

    })
}

exports.CompleteTask = function (taskId) {
    //Mark Task as completed
    return new Promise(function (resolve, reject) {
        if (!taskId) {
            reject("Invalid Task ID - " + taskId);
        } else {
            axios.request({
                url: "/v1/task-instances/" + taskId,
                method: "PATCH",
                data: { "context": {}, "status": "COMPLETED" }
            }).then((res) => {
                console.log("Task " + taskId + " completed!");
                resolve(res.data);
            }).catch((err) => {
                reject(err);
            });
        }
    })
}

function convertUserToActivity(user) {
    //Each Area has an activity. The tasks are assigned to the areas.
    //This is a from/to reference between Areas x Activity types
    switch (user) {
        case "kitchen":
            return process.env.ACTIVITY_KITCHEN
            break;
        case "delivery":
            return process.env.ACTIVITY_DELIVERY
            break;
        default:
            return null;
    }
}

