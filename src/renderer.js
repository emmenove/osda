let data = [];
let config = {};
  
let progress = {
    percent: 0,
    batch: 0,
    total: 0
}


const renderTable = function () {
    let _html = [];
    console.log(data);

    if (!data || data.length <= 0) {
        _html.push('<div class="h-100 w-100 align-items-center justify-content-center text-center p-5">');
        _html.push('<p>no data - Importare un file</p>');
        _html.push('</div>');
        $('#content').html(_html.join('\n'));
        return;
    }

    let cols = [];

    if (data && data[0]) {
        cols = Object.keys(data[0]).filter((e) => !e.startsWith('_')).map(e => ({ title: e, field: e }))
    }

    //generate new table...

    _html.push('<table id="table" class="table table-hover table-striped">');
    // head...
    _html.push('<thead class="table-light sticky-top"><tr>');
    _html.push('<td scope="col"></td>');
    for (let c of cols) {
        _html.push('<td scope="col">' + c.title + '</td>');
    }
    _html.push('</tr></thead>');

    // rows
    _html.push('<tbody>');
    for (let r of data) {
        _html.push('<tr  onClick="displayPage(\'info\',\'' + r._id + '\')">');
        switch (r._topic) {
            case 2: _html.push('<td scope="row"><i class="fa-solid fa-circle-exclamation text-danger"></i></td>'); break;
            case 1: _html.push('<td scope="row"><i class="fa-regular fa-circle-check text-success"></i></td>'); break;
            case 0: _html.push('<td scope="row"><i class="fa-regular fa-circle text-muted"></i></td>'); break;
            default: _html.push('<td scope="row"><i class="fa-regular fa-circle-xmark"></i></td>');
        }
        for (let c of cols) {
            _html.push('<td scope="row">' + (r[c.field] ?? "-") + '</td>');
        }
        _html.push('</tr>');
    }
    _html.push('</tbody>');
    _html.push('</table>');

    $('#content').html(_html.join('\n'));
}

const renderInfo = function (id) {
    console.log('open info', id);

    window.api.getSanctionsById(id).then(r => {

        let name = (r && r.query && r.query.properties && r.query.properties.name) ? r.query.properties.name : 'Nessuna elaborazine';

        let _html = [];
        _html.push('<div class="page-info"></div>');
        _html.push('<div class="card">');
        _html.push('<div class="card-header bg-light sticky-top">');
        _html.push('<span id="info-title">' + name + '</span>');
        _html.push('<i class="fa-solid fa-xmark float-end" onClick="displayPage(\'table\')"></i>');
        _html.push('</div>');
        _html.push('<div class="card-body">');
        _html.push('<pre id="info-content">' + JSON.stringify(r.results, null, 2) + '</pre>');
        _html.push('</div></div></div>');

        $('#content').html(_html.join('\n'));
    });
}

const renderConfig = function () {
    let _html = [];
    _html.push('<form id="form-config">');
    _html.push('<div class="row">');
    _html.push('<div class="col-3"><label>API key</label></div>');
    _html.push('<div class="col">');
    _html.push('<input type="text" class="form-control" id="iApiKey" onChange="saveConfig()">');
    _html.push('</div>');
    _html.push('</div>');

    _html.push('<div class="row">');
    _html.push('<div class="col-3"><label>Collezione</label></div>');
    _html.push('<div class="col">');
    _html.push('<div class="form-check form-check-inline">');
    _html.push('<input class="form-check-input" type="radio" name="checkCollezione" id="iCollezione1" value="default" onChange="saveConfig()" checked>');
    _html.push('<label class="form-check-label" for="iCollezione1">default</label>');
    _html.push('</div>');
    _html.push('<div class="form-check form-check-inline">');
    _html.push('<input class="form-check-input" type="radio" name="checkCollezione" id="iCollezione2" value="sanctions" onChange="saveConfig()">');
    _html.push('<label class="form-check-label" for="iCollezione2">sanctions</label>');
    _html.push('</div>');
    _html.push('<div class="form-check form-check-inline">');
    _html.push('<input class="form-check-input" type="radio" name="checkCollezione" id="iCollezione3" value="pep" onChange="saveConfig()">');
    _html.push('<label class="form-check-label" for="iCollezione3">pep</label>');
    _html.push('</div>');
    _html.push('</div>');
    _html.push('</div>');

    _html.push('<div class="row">');
    _html.push('<div class="col-3"><label>Nominativo</label></div>');
    _html.push('<div class="col">');
    _html.push('<input type="text" class="form-control" id="iNominativo" onChange="saveConfig()">');
    _html.push('</div>');
    _html.push('</div>');

    _html.push('<div class="row">');
    _html.push('<div class="col-3"><label>Giurisdizione</label></div>');
    _html.push('<div class="col">');
    _html.push('<input type="text" class="form-control" id="iGiurisdizione" onChange="saveConfig()">');
    _html.push('</div>');
    _html.push('</div>');

    _html.push('<div class="row">');
    _html.push('<div class="col-3"><label>Indirizzo</label></div>');
    _html.push('<div class="col">');
    _html.push('<input type="text" class="form-control" id="iIndirizzo" onChange="saveConfig()">');
    _html.push('</div>');
    _html.push('</div>');

    _html.push('<div class="row">');
    _html.push('<div class="col-3"><label>limit</label></div>');
    _html.push('<div class="col">');
    _html.push('<input type="number" class="form-control" id="iLimit" onChange="saveConfig()">');
    _html.push('</div>');
    _html.push('</div>');

    _html.push('<div class="row">');
    _html.push('<div class="col-3"><label>threshold</label></div>');
    _html.push('<div class="col">');
    _html.push('<input type="number" class="form-control" id="iThreshold" onChange="saveConfig()">');
    _html.push('</div>');
    _html.push('</div>');

    _html.push('<div class="row">');
    _html.push('<div class="col-3"><label>cutoff</label></div>');
    _html.push('<div class="col">');
    _html.push('<input type="number" class="form-control" id="iCutoff" onChange="saveConfig()">');
    _html.push('</div>');
    _html.push('</div>');


    _html.push('<div class="row">');
    _html.push('<div class="col-3"><label>algorithm</label></div>');
    _html.push('<div class="col">');
    _html.push('<select class="form-select" id="algorithm" onChange="saveConfig()">');
    _html.push('<option value="logic-v1" selected>logic-v1 (best)</option>');
    _html.push('<option value="name-based">name-based</option>');
    _html.push('<option value="name-qualified">name-qualified</option>');
    _html.push('<option value="regression-v1">regression-v1</option>');
    _html.push('<option value="regression-v2">regression-v2</option>');
    _html.push('</select>');
    _html.push('</div>');
    _html.push('</div>');


    _html.push('</form>');
    $('#content').html(_html.join('\n'));
    updateConfig();
}


const renderProgress = function () {
    let _html = [];
    _html.push('<div class="h-100 w-100 align-items-center justify-content-center text-center p-5">');
    _html.push('<div class="progress center-block m-auto w-75">');
    _html.push('<div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="' + progress.percent + '" aria-valuemin="0" aria-valuemax="100" style="width: ' + progress.percent + '%"></div>');
    _html.push('</div>');
    _html.push('<p>Process batch ' + progress.batch + ' / ' + progress.total + '</p>')
    _html.push('</div>');
    $('#content').html(_html.join('\n'));
}

const displayPage = function (page, args) {
    console.log(page);
    switch (page) {
        case 'info': renderInfo(args); break;
        case 'config': renderConfig(); break;
        case 'progress': renderProgress(); break;
        default: renderTable(); break;
    }
}

const saveConfig = function () {
    console.log('saving config');
    getConfig();
    window.api.saveConfig(config);
}

const getConfig = function () {
    config = {
        apiKey: $('#iApiKey').val(),
        collezione: $('input[name="checkCollezione"]:checked').val(),
        nominativo: $('#iNominativo').val(),
        giurisdizione: $('#iGiurisdizione').val(),
        indirizzo: $('#iIndirizzo').val(),
        limit: $('#iLimit').val(),
        threshold: $('#iThreshold').val(),
        cutoff: $('#iCutoff').val(),
        cutoff: $('#iCutoff').val(),
        algorithm:$('#algorithm').val(),
    }
}

const updateConfig = function () {
    console.log('update config', config);

    $('#iApiKey').val(config.apiKey);
    switch (config.collezione) {
        case 'sanctions': $('#iCollezione2').prop('checked', true); break;
        case 'pep': $('#iCollezione3').prop('checked', true); break;
        default: $('#iCollezione1').prop('checked', true); break;
    }
    $('#iNominativo').val(config.nominativo);
    $('#iGiurisdizione').val(config.giurisdizione);
    $('#iIndirizzo').val(config.indirizzo);
    $('#iLimit').val(config.limit);
    $('#iThreshold').val(config.threshold);
    $('#iCutoff').val(config.cutoff);
    $('#algorithm').val(config.algorithm);
}

window.api.onImport((value) => {
    console.log('window.api.onDataImported');
    data = value;
    displayPage('table');
})

window.api.onNavigateTo((value) => {
    console.log('window.api.onNavigateTo', value);
    displayPage(value);
})

window.api.onCheckProcess((value) => {
    console.log(value);
    if (value.event === 'start') {
        progress = {
            percent: 0,
            batch: 0,
            total: value.total
        }
        displayPage('progress');
    }
    if (value.event === 'progress') {
        progress.percent = value.percent;
        progress.batch = value.batch;
        displayPage('progress');
    }
    if (value.event === 'end') {
        data = value.data;
        displayPage('table');
    }
})


window.addEventListener('DOMContentLoaded', () => {
    window.api.init().then(init => {
        config = init.config ?? {}
        data = init.data;
        displayPage('table');
    });
})

