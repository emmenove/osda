const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('fs');
var _ = require('lodash');
const excelToJson = require('convert-excel-to-json');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

// variabile principale!
let data = [];
let sanctions = {};
let config = {};
let mainWindow;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  ipcMain.handle('save-config', async (event, newConfig) => {
    try {
      fs.writeFileSync("./db/config.json", JSON.stringify(newConfig, null, 2));
      config = newConfig;
    } catch (e) {
      console.log('save-config error', e);
    }
    return true;
  })

  ipcMain.handle('get-sanctions', async (event, id) => {
    return sanctions[id];
  })

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Import",
          click: async () => {
            const { dialog } = require('electron')
            // richiedi il file
            const filepath = dialog.showOpenDialogSync({
              filters: [
                { name: 'Foglio di lavoro di Microsoft Excel', extensions: ['xlsx'] },
              ],
              properties: ['openFile']
            })

            // leggi il file
            const result = excelToJson({
              sourceFile: filepath[0],
              header: {
                rows: 1
              },
              columnToKey: {
                '*': '{{columnHeader}}'
              }
            });

            cleanUpAndStoreData(result);
            // invia alla pagina
            mainWindow.webContents.send('data-imported', data)
            console.log('send data-imported');
          }
        },
        {
          label: "Clean",
          click: async () => {
            data=[];
            sanctions={};
            fs.writeFileSync("./db/data.json", JSON.stringify(data, null, 2));
            fs.writeFileSync("./db/sanctions.json", JSON.stringify(sanctions, null, 2));
            mainWindow.webContents.send('data-imported', data)
          }
        },

        {
          label: "Quit",
          role: 'quit'
        }
      ]
    },
    {
      label: "Views",
      submenu: [
        {
          label: "Data",
          click: async () => {
            mainWindow.webContents.send('navigate-to', 'table');
          }
        },
        {
          label: "Config",
          click: async () => {
            mainWindow.webContents.send('navigate-to', 'config');
          }
        },

      ]
    },
    {
      label: "Process",
      submenu: [
        {
          label: "Check",
          click: async () => {
            console.log('checkSanctions......');
            mainWindow.webContents.send('check-process', { event: 'start' });

            // create batch
            let chunks = _.chunk(data, 30);
            let index = 0;
            for (let c of chunks) {
              index++;
              let result = await processBatch(c);
              mainWindow.webContents.send('check-process', {
                event: 'progress',
                percent: percentage(index, chunks.length),
                result: result
              });
            }

            // update data on files
            fs.writeFileSync("./db/data.json", JSON.stringify(data, null, 2));
            fs.writeFileSync("./db/sanctions.json", JSON.stringify(sanctions, null, 2));

            mainWindow.webContents.send('check-process', { 
              event: 'end',
              data : data 
            });
          }
        }
      ]
    },

  ]);
  Menu.setApplicationMenu(menu);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});


ipcMain.handle('init', async () => {
  // startup
  let init = {};
  try {
    console.log('reading init data....');
    init.config = JSON.parse(fs.readFileSync('./db/config.json', 'utf8'));
    init.data = JSON.parse(fs.readFileSync('./db/data.json', 'utf8'));
    init.sanctions = JSON.parse(fs.readFileSync('./db/sanctions.json', 'utf8'));
  } catch (e) {
    console.log('Error reading init data', e);
  }
  config = init.config ?? {};
  data = init.data ?? [];
  sanctions = init.sanctions ?? {};
  return init;
})


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
const cleanUpAndStoreData = function (result) {
  if (result) {
    // solo il primo foglio!
    let newData = Object.values(result)[0];
    // internal fields
    for (let element of newData) {
      element._id = uuidv4();
    }

    if (!data) data = [];
    data.push(...newData);
  }
  fs.writeFileSync("./db/data.json", JSON.stringify(data, null, 2));
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function percentage(partialValue, totalValue) {
  return parseFloat((100 * partialValue) / totalValue).toFixed(1);;
}


async function processBatch(batch) {
  //prepare data:
  let queries = {};
  for (let b of batch) {
    let o = {
      schema: 'Company',
      properties: {
        name: [
          b[config.nominativo]
        ],
        jurisdiction: [
          b[config.giurisdizione]
        ]
      }
    }
    queries[b._id] = o;
  }
  let postData = JSON.stringify({ queries });

  var options = {
    'method': 'POST',
    'hostname': 'api.opensanctions.org',
    'path': '/match/default',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'de95c1c616a18fb15de8ae9808a63262'
    },
    'maxRedirects': 20
  };

  const url = 'https://api.opensanctions.org/match/'+config.collezione;
  const result = await fetch(url, {
    method: 'post',
    body: postData,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': config.apiKey
    },
  });
  const resultJson = await result.json();
  const responses = resultJson.responses ?? {};
  let ids = Object.keys(responses);
  for (let id of ids) {
    sanctions[id] = responses[id];
    let d = data.find(e => e._id === id);
    if (!d) {
      console.log('Data', id, 'not found!');
      continue;
    }
    //check severity and update data
    let matches = responses[id].results;
    d._topic = 0; //processato senza risultati
    for (let m of matches) {
      if (!_.isEmpty(m.properties.topics)) {
        d._topic = 2; //topic
      }else{
        d._topic = 1; //risultato ma senza topic
      }
    }
  }


  //update results..


  return resultJson;

}






