const axios = require("axios");
let csrfToken;

module.exports = {
    GetFixedAssets: function () {
        //Starts a new WF instance
        return (GetFixedAssets());
    },
    
    GetCostCenters: function () {
        //Starts a new WF instance
        return (GetCostCenters());
    },

    GetFixedAssetDetail: function (itemName) {
        return (GetFixedAssetDetail(itemName));
    },

    PostAssetAssignment: function (assetAssignment) {
        return (PostAssetAssignment(assetAssignment));
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Begining of retry machanism for 401/403 erros for axios instance.
/* Original source code: https://gist.github.com/nzvtrk/ebf494441e36200312faf82ce89de9f2
 * Basic example of save cookie using axios in node.js and recreate session if it expired.
 * Get/save cookie manually cause WithCredential axios param use XHR and not work in node.js
 * Supports parallel request and send only one create session request.
 * */

const BASE_URL = process.env.ERP_BASE_URL;

// Init instance of axios which works with BASE_URL
const axiosInstance = axios.create({ baseURL: BASE_URL });

const createSession = async () => {
    console.log("Creating session");

    const res = await axios.request({
        url: process.env.ERP_CSRF_TOKEN_URL_PATH,
        method: "GET",
        auth: {
            username: process.env.ERP_USER,
            password: process.env.ERP_USER_PASSWORD
        },
        baseURL: process.env.ERP_BASE_URL,
        headers: {
            "x-csrf-token": "fetch"
        },
        params: {
            "$format": "json"
        }
    });

    //Set up the x-csrf-token as default request header
    csrfToken = res.headers['x-csrf-token'];
    axiosInstance.defaults.headers.common['x-csrf-token'] = csrfToken;

    //Setup the basic authentication.
    const base64AuthData = Buffer.from(`${process.env.ERP_USER}:${process.env.ERP_USER_PASSWORD}`).toString('base64');
    const authorization = `Basic ${base64AuthData}`;
    axiosInstance.defaults.headers.common['Authorization'] = authorization;

    //Setup the cookie
    const cookie = res.headers["set-cookie"]; // get cookie from request
    axiosInstance.defaults.headers.Cookie = cookie; // attach cookie to axiosInstance for future requests

    let context = {};
    context.cookie = cookie;
    context.authorization = authorization;
    context.token = csrfToken;

    return context; // return Promise<cookie> cause func is async
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
axiosInstance.interceptors.response.use(null, error => {
    console.error(error.message); 

    const { response = {}, config: sourceConfig } = error;

    // check if request failed cause Unauthorized or forbidden
    if (response.status === 401 || response.status === 403) {
        console.log("The error is due to unauthorized or session expired. \nWe'll create a new session and retry the request.");
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
                console.log("Retry with new session context %s request to %s", sourceConfig.method, sourceConfig.url);

                //******************************************************************************************/
                // Option 1: Setup the required headers: cookie,token and authorization, reintialise
                // an request with axios(sourceConfig)
                //******************************************************************************************/
                sourceConfig.headers.Cookie = context.cookie; 
                sourceConfig.headers['x-csrf-token'] = context.token;
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
                //resolve(axiosInstance.request(sourceConfig));
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

const GetFixedAssets = function () {
    return new Promise(function (resolve, reject) {
        axiosInstance.request({
            url: "/sap/byd/odata/cust/v1/yst_fixedasset/FixedAssetCollection",
            method: "GET",
            params: {
                "$format": "json",
                "$select": "ObjectID,ID,MasterFixedAssetID,Name",
                "$filter": "LifeCycleStatusCode eq '3'"
            }
        }).then((res) => {
            console.log("Assets retrived");
            resolve(res.data);
        }).catch((err) => {
            reject(err);
        });
    })
}

const GetFixedAssetDetail = function (itemName) {
    //Starts the Workflow Instance. The beggining of the process
    return new Promise(function (resolve, reject) {
        const items = require("./data/items.json");
        const result = items.filter(item => item.Description.toLowerCase().includes(itemName.toLowerCase()));
        resolve(result);
    })
}

const GetCostCenters = function () {
    //?$format=json&$select=Name,CostCentre/UUID&$expand=CostCentre
    return new Promise(function (resolve, reject) {
        axiosInstance.request({
            url: "/sap/byd/odata/cust/v1/khcostcentre/CostCentreCurrentNameCollection",
            method: "GET",
            params: {
                "$format": "json",
                "$select": "Name,CostCentre/UUID",
                "$expand": "CostCentre"
            }
        }).then((res) => {
            console.log("CC retrived");
            resolve(res.data);
        }).catch((err) => {
            reject(err);
        });
    })
}

const PostAssetAssignment = function (assetAssignment) {
    return new Promise(function (resolve, reject) {

        axiosInstance.request({
            url: "/sap/byd/odata/cust/v1/yst_fixedasset/FixedAssetOrganisationalAssignmentCollection",
            method: "POST",
            //baseURL: process.env.ERP_BASE_URL,
            headers: {
                "content-type": "application/json"
            },
            data: assetAssignment,
        }).then((res) => {
            console.log("Asset asssignment posted");
            resolve(res.data)
        }).catch((err) => {
            //handleResponseError(err);
            reject(err);
        });
    })
}

//Not in use
let getCSRFToken = function (url) {
    return new Promise(function (resolve, reject) {
        axios.request({
            url: url,
            method: "GET",
            auth: {
                username: process.env.ERP_USER,
                password: process.env.ERP_USER_PASSWORD
            },
            baseURL: process.env.ERP_BASE_URL,
            headers: {
                "x-csrf-token": "fetch"
            },
            params: {
                "$format": "json"
            }
        }).then((res) => {
            console.log("x-csrf-token retrieved Succesfully!");
            csrfToken = res.headers['x-csrf-token'];
            //set up the x-csrf-token as default request header for post/put/patch
            //axios.defaults.headers.common['x-csrf-token'] = csrfToken;
            axios.defaults.headers.post['x-csrf-token'] = csrfToken;
            axios.defaults.headers.patch['x-csrf-token'] = csrfToken;
            axios.defaults.headers.put['x-csrf-token'] = csrfToken;
            axios.defaults.headers.delete['x-csrf-token'] = csrfToken;

            axios.defaults.headers.post['Content-Type'] = 'application/json';

            //Triky thing: Cookie is required for the following request, not just x-csrf-token
            //Both options below work fine.
            const cookie = res.headers["set-cookie"];
            axios.defaults.headers.common['Cookie'] = cookie;
            //axios.defaults.headers.Cookie = cookie;

            //setup the basic authentication to ERP API
            const base64data = Buffer.from(`${process.env.ERP_USER}:${process.env.ERP_USER_PASSWORD}`).toString('base64');
            axios.defaults.headers.common['Authorization'] = `Basic ${base64data}`;

            resolve(csrfToken);
        }).catch((error) => {
            console.error(error);
            reject(error);
        });
    });
}

//Not in use.
let handleResponseError = function (err) {
    console.error(err);

    if (err.response.statusCode == 403 ||
        err.response.statusCode == 401) {
        //no or expired x-csrf-token  
        console.log("get x-csrf-token");
        getCSRFToken(process.env.ERP_CSRF_TOKEN_URL_PATH);
    }
}

//getCSRFToken(process.env.ERP_CSRF_TOKEN_URL_PATH);
//createSession();