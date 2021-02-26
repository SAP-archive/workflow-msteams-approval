const express = require('express');
const workflow = require('../modules/workflow');
const erp = require('../modules/erp');
const router = express.Router();

router.get('/', (req, res) => res.send('<h1>SMB Request Approval API</h1>'));
module.exports = router;

router.get('/tasks', function (req, res) {
    workflow.GetTasks(req.query.user).then((data) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json');
        res.send(formatTasks(data));
    }).catch((error) => {
        console.error('Error getting user tasks' + error)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json');
        if (error.message) {
            error = error.message
        }
        res.send({ msg: error });
    })

});

router.post('/completeTask', function (req, res) {
    //Complete a task for an ID and if passed a WF instance ID it also
    //Returns the subsequent task as response.
    workflow.CompleteTask(req.query.taskId).then((data) => {
        if (req.query.instanceID) {
            workflow.GetOpenTaskOnInstance(req.query.instanceID).then((data) => {
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json');
                res.send(data);
            })
        } else {
            res.statusCode = 204
            res.setHeader('Content-Type', 'application/json');
            res.send(data);
        }
    }).catch((error) => {
        console.error('Error completing task' + error)
        if (error.response.data.error.details[0].message) {
            console.error(error.response.data.error.details[0].message)
        }
        res.statusCode = error.response.status
        res.setHeader('Content-Type', 'application/json');
        if (error.message) {
            error = error.message
        }
        res.send({ msg: error });
    })
});

router.get('/taskContext', function (req, res) {
    workflow.GetTaskContext(req.query.taskId).then((data) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json');
        data.id = req.query.taskId
        res.send(data);
    }).catch((error) => {
        console.error('Error getting task context' + error)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json');
        if (error.message) {
            error = error.message
        }
        res.send({ msg: error });
    })
});

router.get('/instanceStatus', function (req, res) {
    workflow.GetOpenTaskOnInstance(req.query.instanceID).then((data) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    }).catch((error) => {
        console.error('Error getting instance status' + error)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json');
        if (error.message) {
            error = error.message
        }
        res.send({ msg: error });
    })

});

router.get('/instances', function (req, res) {
    workflow.GetInstancesByAttribute(req.query.filter).then((data) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    }).catch((error) => {
        console.error('Error getting instances' + error)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json');
        if (error.message) {
            error = error.message
        }
        res.send({ msg: error });
    })

});

router.post('/start', function (req, res) {
    workflow.StartInstance(req.body).then((data) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    }).catch((error) => {
        console.error('Error starting instance')
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json');
        if (error.message) {
            error = error.message
        }
        res.send({ msg: error });
    })
});

router.get('/assets', function (req, res) {
    erp.GetFixedAssets().then((data) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    }).catch((error) => {
        console.error('Error getting Items context' + error)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json');
        if (error.message) {
            error = error.message
        }
    })
});

router.get('/item/:itemName', function (req, res) {
    let itemName = req.params.itemName;
    res.setHeader('Content-Type', 'application/json');
    if (!itemName || typeof itemName === 'undefined') {
        res.statusCode = 500;
        res.json({ error: 'No query param itemName found' });
        return;
    }

    erp.GetFixedAssetDetail(itemName).then((data) => {
        res.statusCode = 200;

        res.send(data);
    }).catch((error) => {
        console.error('Error getting Item context' + error)
        res.statusCode = 500;

        if (error.message) {
            error = error.message;
        }
    })
});

router.get('/costCenters', function (req, res) {
    erp.GetCostCenters().then((data) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    }).catch((error) => {
        console.error('Error getting Items context' + error)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json');
        if (error.message) {
            error = error.message
        }
    })
});


router.post('/assetAssignment', function (req, res) {
    erp.PostAssetAssignment(req.body).then((data) => {
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        
        let assetAssignmentRepsonse = {};
        assetAssignmentRepsonse.AssetAssignmentObjectID = data.d.results.ObjectID;
        res.send(assetAssignmentRepsonse);

    }).catch((error) => {
        console.error('An error occurs on posting asset assignment');

        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json');
        if (error.message) {
            error = error.message;
        }
        res.send({ msg: error });
    })
});

function formatTasks(tasks) {
    // var formattedTasks = []
    // tasks.forEach(element => {
    //     item = {
    //         id: element.id, 
    //         createdAt: element.createdAt, 
    //         subject:element.subject,
    //         workflowInstanceId:element.workflowInstanceId}
    //         formattedTasks.push(item)
    // });
    return tasks;
}
