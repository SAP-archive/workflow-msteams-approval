const fetch = window.fetch;
// Get the user context from Teams
let teamsContext;
let user;

const onLoad = function () {
  registerEvents();
  loadTeamsContext();
  loadAssets();
  loadCostCenters();
  document.getElementById('requestDate').value = (new Date()).toISOString().split("T")[0];
}

const registerEvents = () => {
  document.getElementById('new-tile').addEventListener('click',onClickNewTiles);
  document.getElementById('closeBtn').addEventListener('click',onCloseClick);
}

const onClickNewTiles = () => {
  document.getElementById('request-form-modal').classList.toggle("show-modal");
}

const onCloseClick = (event) => {
  document.getElementById('request-form-modal').classList.toggle("show-modal");
}

const loadTeamsContext = () =>{
  return new Promise((resolve, reject) =>
  {
    try {
      microsoftTeams.initialize();
  
      microsoftTeams.getContext((teamsContext, error) => {
        if (teamsContext) {
          user = Object.keys(teamsContext).length > 0 ? teamsContext['upn'] : '';
          //let userName = user.substring(0, user.indexOf('@'));
          document.getElementById('requestBy').value = user;
          loadRequests();
          resolve(user);
        }
  
        if (error) {
          console.error(error);
          retject(error);
        }
      });
    } catch (error) {
      console.error(error);
      reject(error);
    } 
  });
}

const loadRequests = function() {
  let url = '/api/instances';

  if (user)
    url = `${url}?filter=attributes.requestBy=${user}`;

  fetch(url, {
    method: 'GET'
  })
    .then(response => response.json())
    .then(data => {
      console.log('Loaded requests');
      let tbody = document.getElementById('request-tbody');
      tbody.innerHTML = '';

      const runningInstances =  data.filter(element => element.status === 'RUNNING');
      const completedInstances =  data.filter(element => element.status === 'COMPLETED');
      const errInstances =  data.filter(element => element.status === 'ERRONEOUS');

      document.getElementById('total-tile').getElementsByTagName('h2')[0].innerText = data.length;
      document.getElementById('sent-tile').getElementsByTagName('h2')[0].innerText = runningInstances.length;
      document.getElementById('completed-tile').getElementsByTagName('h2')[0].innerText = completedInstances.length;
      //document.getElementById('total-tile').getElementsByTagName('h2')[0].innerText = data.length;

      data.forEach(element => {
        let requestBy = '';
        if (element && element.attributes && element.attributes[0])
          requestBy = element.attributes[0].value;

        tbody.innerHTML +=
          `<tr>
          <td data-label="Subject">${element.subject}</td>
          <td data-label="Status">${element.status}</td>
          <td data-label="Created on">${element.startedAt}</td>
          <td data-label="Requested by">${requestBy}</td>
        </tr>`;
      });
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

const loadAssets = function () {
  fetch('/api/assets', {
    method: 'GET' 
  })
    .then(response => response.json())
    .then(data => {
      assetIDSelect = document.getElementById('assetID');
      data.d.results.forEach(element => {
        const option = document.createElement('option');
        option.text = `${element.MasterFixedAssetID}-${element.ID} ${element.Name}`;
        option.value = element.ObjectID;
        assetIDSelect.append(option);
      });
    })
    .catch((error) => {
      console.error('Error:', error);
    });
};

function loadCostCenters() {
  fetch('/api/costCenters', {
    method: 'GET' 
  })
    .then(response => response.json())
    .then(data => {
      let costCenterIDSelect = document.getElementById('costCenterID');
      data.d.results.forEach(element => {
        const option = document.createElement('option');
        option.text = element.Name;
        option.value = element.CostCentre.UUID;
        costCenterIDSelect.append(option);
      });
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

function startFlow() {
  
  let submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;

  let assetIDSelect = document.getElementById('assetID');
  let assetID = assetIDSelect.value;
  let assetName = assetIDSelect.options[assetIDSelect.selectedIndex].text;

  let costCenterIDSelect = document.getElementById('costCenterID');
  let costCenterID = costCenterIDSelect.value;
  let costCenterName = costCenterIDSelect.options[costCenterIDSelect.selectedIndex].text;

  let data = {
    approvalSequence: 1,
    approveBy: document.getElementById('approveBy').value,
    assetRequest: {
      requestBy: document.getElementById('requestBy').value,
      assetID: assetID,
      assetName: assetName,
      costCenterID: costCenterID,
      costCenterName: costCenterName,
      requestDate: document.getElementById('requestDate').value,
      startDate: document.getElementById('startDate').value,
      endDate: document.getElementById('endDate').value,
      requestRemarks: document.getElementById('remarks').value,
      approvalRemarks: '',
      approvalStatus: 'New'
    }
  }

  fetch('/api/start', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }).then(response => response.json())
    .then(data => {
      console.log('Request submitted');
      alert(`Assignment request submitted for asset ${assetName} to cost center ${costCenterName}.\nA workflow instance is created with id as ${data.id}.`);
      onCloseClick();
      loadRequests();
    })
    .catch((error) => {
      console.error('Error:', error);
      alert(`An error has occurred while submitting the request.`);
    })
    .finally(() => {
      submitBtn.disabled = false;
    });
}

window.addEventListener('load', onLoad, false);