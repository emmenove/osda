const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('fs');
var _ = require('lodash');
const excelToJson = require('convert-excel-to-json');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const { dialog } = require('electron');
const excel = require("exceljs");
const internal = require('node:stream');
const { updateElectronApp, UpdateSourceType } = require('update-electron-app');
const { URLSearchParams } = require('node:url');


updateElectronApp({
  updateInterval: '1 hour',
  logger: require('electron-log')
})


// variabile principale!
let data = [];
let sanctions = {};

// default config
let config = {
  apiKey: "",
  collezione: "default",
  nominativo: "",
  giurisdizione: "",
  indirizzo: "",
  limit: 5,
  threshold: 0.7,
  cutoff: 0.5
};
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
      fs.writeFileSync(app.getPath('userData') + "/config.json", JSON.stringify(newConfig, null, 2));
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
            // richiedi il file
            const filepath = dialog.showOpenDialogSync({
              filters: [
                { name: 'Foglio di lavoro di Microsoft Excel', extensions: ['xlsx'] },
              ],
              properties: ['openFile']
            })

            // leggi il file
            try {
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

              dialog.showMessageBox(mainWindow, {
                message: 'Import completato',
                type: 'info'
              })

            } catch (e) {
              dialog.showMessageBox(mainWindow, {
                message: 'Export in import',
                detail: JSON.stringify(e, null, 2),
                type: 'error'
              })

            }
          }
        },
        {
          label: "Clean",
          click: async () => {
            data = [];
            sanctions = {};
            fs.writeFileSync(app.getPath('userData') + '/data.osda', JSON.stringify(data, null, 2));
            fs.writeFileSync(app.getPath('userData') + '/sanctions.osdar', JSON.stringify(sanctions, null, 2));
            mainWindow.webContents.send('data-imported', data)
            dialog.showMessageBox(mainWindow, {
              message: 'Clean completato',
              type: 'info'
            })

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

            // check configurazione
            let configErrors = [];
            if (!config) configErrors.push('Configurazione non trovata');
            if (!config.apiKey) configErrors.push('API KEY non impostata');
            if (!config.nominativo) configErrors.push('nominativo non impostato');

            if (!_.isEmpty(configErrors)) {
              dialog.showMessageBox(mainWindow, {
                message: 'Configurazione errata',
                detail: configErrors.join('\r\n'),
                type: 'error'
              });
              return;
            }

            // create batch
            let chunks = _.chunk(data, 30);
            mainWindow.webContents.send('check-process',
              {
                event: 'start',
                percent: 0,
                batch: 0,
                total: chunks.length
              });

            let index = 0;
            for (let c of chunks) {
              index++;

              try {
                let result = await processBatch(c);
                mainWindow.webContents.send('check-process', {
                  event: 'progress',
                  percent: percentage(index, chunks.length),
                  batch: index,
                  total: chunks.length,
                  result: result
                });
              } catch (e) {
                dialog.showMessageBox(mainWindow, {
                  message: 'Errore nel check',
                  detail: e.toString(),
                  type: 'error'
                })
                mainWindow.webContents.send('check-process', {
                  event: 'end',
                  data: data
                });
                return;
              }

            }

            // update data on files
            fs.writeFileSync(app.getPath('userData') + '/data.osda', JSON.stringify(data, null, 2));
            fs.writeFileSync(app.getPath('userData') + '/sanctions.osdar', JSON.stringify(sanctions, null, 2));

            mainWindow.webContents.send('check-process', {
              event: 'end',
              data: data
            });
          }
        }
      ]
    },
    {
      label: "Export",
      submenu: [
        {
          label: "Export raw results",
          click: async () => {
            console.log('exporting raw ......');

            const options = {
              filters: [
                { name: 'File JSON', extensions: ['json'] },
              ],
              defaultPath: app.getPath('documents') + '/raw-results.json',
            }
            try {
              const result = await dialog.showSaveDialog(mainWindow, options);
              fs.writeFileSync(result.filePath, JSON.stringify(sanctions, null, 2));
              dialog.showMessageBox(mainWindow, {
                message: 'Export completato',
                type: 'info'
              })

            } catch (e) {
              dialog.showMessageBox(mainWindow, {
                message: 'Export nella esportazione raw',
                detail: JSON.stringify(e, null, 2),
                type: 'error'
              })

            }

          }
        },
        {
          label: "Export excel results",
          click: async () => {
            console.log('exporting excel ......');

            const options = {
              filters: [
                { name: 'Foglio di lavoro di Microsoft Excel', extensions: ['xlsx'] },
              ],
              defaultPath: app.getPath('documents') + '/results.xlsx',
            }
            try {
              const result = await dialog.showSaveDialog(mainWindow, options);
              const xlsx = await exportExcelResult();
              fs.writeFileSync(result.filePath, xlsx);
              dialog.showMessageBox(mainWindow, {
                message: 'Export completato',
                type: 'info'
              })
            } catch (e) {
              dialog.showMessageBox(mainWindow, {
                message: 'Errore nella esportazione',
                detail: JSON.stringify(e, null, 2),
                type: 'error'
              })
            }

          }
        }

      ]
    },
  ]);
  Menu.setApplicationMenu(menu);

  // Open the DevTools.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

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
    init.config = JSON.parse(fs.readFileSync(app.getPath('userData') + "/config.json", 'utf8'));
    init.data = JSON.parse(fs.readFileSync(app.getPath('userData') + '/data.osda', 'utf8'));
    init.sanctions = JSON.parse(fs.readFileSync(app.getPath('userData') + '/sanctions.osdar', 'utf8'));
  } catch (e) {
    console.log('Error reading init data', e);
  }
  if (!_.isEmpty(init.config)) {
    config = init.config;
  } else {
    init.config = config;
  }
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
  fs.writeFileSync(app.getPath('userData') + '/data.osda', JSON.stringify(data, null, 2));
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
        id: b.id
      }
    }
    // aggiungo solo i campi presenti
    if (!_.isEmpty(config.nominativo) && !_.isEmpty(b[config.nominativo])) {
      o.properties.name = b[config.nominativo];
    }
    if (!_.isEmpty(config.giurisdizione) && !_.isEmpty(b[config.giurisdizione])) {
      o.properties.jurisdiction = b[config.giurisdizione];
    }
    if (!_.isEmpty(config.indirizzo) && !_.isEmpty(b[config.indirizzo])) {
      o.properties.indirizzo = b[config.indirizzo];
    }
    if (!_.isEmpty(config.registrationNumber) && !_.isEmpty(b[config.registrationNumber])) {
      o.properties.registrationNumber = b[config.registrationNumber];
    }
    if (!_.isEmpty(config.incorporationDate) && !_.isEmpty(b[config.incorporationDate])) {
      o.properties.incorporationDate = b[config.incorporationDate];
    }

    queries[b._id] = o;
  }
  let postData = JSON.stringify({ queries });

  const url = 'https://api.opensanctions.org/match/' + config.collezione;

  // parametri
  const queryParams = new URLSearchParams();
  try {

    if (!_.isEmpty(config.limit)) queryParams.append('limit', parseInt(config.limit));
    if (!_.isEmpty(config.threshold)) queryParams.append('threshold', parseFloat(config.threshold));
    if (!_.isEmpty(config.cutoff)) queryParams.append('cutoff', parseFloat(config.cutoff));
    if (!_.isEmpty(config.algorithm)) queryParams.append('algorithm', config.algorithm);

    // info, non dovrebbe essere qui la conversione, ma sul salvataggio della config... ma
    // per il momento è così
    if (!_.isEmpty(config.include_dataset)) {
      config.include_dataset.split(',').forEach(p=>{
        queryParams.append('include_dataset', p);  
      })
  }
    if (!_.isEmpty(config.exclude_schema)) {
      config.exclude_schema.split(',').forEach(p=>{
        queryParams.append('exclude_schema', p);  
      })
  }
    if (!_.isEmpty(config.exclude_dataset)) {
      config.exclude_dataset.split(',').forEach(p=>{
        queryParams.append('exclude_dataset', p);  
      })
  }
    if (!_.isEmpty(config.topics)) {
      config.topics.split(',').forEach(p=>{
        queryParams.append('topics', p);  
      })
  }

  } catch (e) {
    throw new Error('Error adding query parameters: ');
  }

  let result = null;
  let urlCall = url + '?' + queryParams.toString();
  console.log(urlCall);
  result = await fetch(urlCall, {
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

    let d = data.find(e => e._id === id);
    if (!d) {
      console.log('Data', id, 'not found!');
      continue;
    }
    //cleanup
    delete sanctions[id];
    d._topic = 0;

    sanctions[id] = responses[id];

    //check severity and update data
    let matches = responses[id].results;
    for (let m of matches) {
      if (!_.isEmpty(m.properties.topics)) {
        d._topic = d._topic < 2 ? 2 : d._topic; //topic
      } else {
        d._topic = d._topic < 1 ? 1 : d._topic; //risultato ma senza topic
      }
    }
  }
  return sanctions;

}

const exportExcelResult = async function () {
  let workbook = new excel.Workbook(); // Creating workbook
  let worksheet = workbook.addWorksheet("Analisi"); // Creating worksheet

  // costruisco le colonne, prima i risultati
  let columnsResults = [
    { header: "Name", key: "_name" },
    { header: "Topics", key: "_topics" },
    { header: "Notes", key: "_notes" },
    { header: "Registration number", key: "_registrationNumber" },
    { header: "Source url", key: "_sourceUrl" },
    { header: "Address", key: "_address" },
    { header: "Dataset", key: "_datasets" },
    { header: "Score", key: "_score" }
  ];
  // e aggiungo tutte le colonne di data
  let columnsData = Object.keys(data[0]).filter((e) => !e.startsWith('_')).map(e => ({ header: e, key: e }))
  let columns = [];
  columns.push(...columnsResults);
  columns.push(...columnsData);
  worksheet.columns = columns;

  // creo il json dei dati incrociando data e sanctions
  let rows = [];
  for (let d of data) {
    const s = sanctions[d._id];

    // template row with initial values
    const r = {};
    for (let c of columnsResults) {
      r[c.key] = '';
    }
    for (let c of columnsData) {
      r[c.key] = '';
      if (!_.isEmpty(d[c.key])) {
        r[c.key] = d[c.key];
      }
    }

    // helper function start..
    const getProperty = function (key, result) {
      key = key.substring(1);
      let o = result.properties ? result.properties[key] : null;
      if (o) {
        if (typeof o === 'string') {
          return o;
        } else {
          try {
            return o.join('\r\n');
          } catch (e) { }
        }
      }
      return '';
    }
    let rindex = 0;
    const addRow = function (row) {
      rindex++;
      worksheet.addRow(row);
    }

    //sanctions
    if (!_.isEmpty(s.results)) {
      for (let re of s.results) {
        let newRow = Object.assign({}, r);
        // campi properties
        for (let c of columnsResults) {
          newRow[c.key] = getProperty(c.key, re);
        }
        newRow._dataset = re.dataset;
        newRow._score = re.score;
        addRow(newRow);

      }
    } else {
      addRow(r);
    }
  }

  let b = await workbook.xlsx.writeBuffer();
  return b;
}






