#!/Users/andrew/.nvm/versions/node/v8.11.2/bin/node
const Promise = require('bluebird');
const rp = require('request-promise');
const moment = require('moment');

function getUrl(params) {
    return `http://mschart.morningstar.com/chartweb/defaultChart`;
}

function getQueryString(params) {
    const { secid, price, nav } = params;
    // https://mschart.morningstar.com/chartweb/defaultChart?
    //  type=gettid
    //  symbol=XNYS%3ANAN%2C
    //  region=usa
    //  ifmt=0
    //  callback=jQuery16404078118428976243_1543322754649
    //  _=1543322760367

    // 8225 = price, 8217 = nav
    const dataid = params.dimension === 'price' ? 8225 : 8217;
    return {
        type: 'getcc',
        secids: params.secid,
        dataid: dataid,
        startdate: '1900-01-01',
        enddate: '2018-11-14',
        currency: undefined,
        format: 1,
        _: +new Date(),
    };
};

function getHeaders() {
    return {
        'Pragma': 'no-cache',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'http://quotes.morningstar.com/chart/cef/chart.action?t=NAN&region=usa&culture=en-US',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
    };
}

const funds = [
    { symbol: 'NAN', secid: 'FCUSA04ADG;FC', dimension: 'price' },
    { symbol: 'NAN', secid: 'FCUSA04ADG;FC', dimension: 'nav'   },
    { symbol: 'NBO', secid: 'FCUSA000I6;FC', dimension: 'price' },
    { symbol: 'NBO', secid: 'FCUSA000I6;FC', dimension: 'nav'   },
    { symbol: 'BQH', secid: 'FCUSA04AED;FC', dimension: 'price' },
    { symbol: 'BQH', secid: 'FCUSA04AED;FC', dimension: 'nav'   },
];

Promise.map(funds, fund => (
    rp({
        uri: getUrl(),
        qs: getQueryString({ secid: fund.secid, dimension: fund.dimension }),
        headers: getHeaders(),
        json: true
    })
)).then(responses => {
    const headers = funds.map(fund => `${fund.symbol} ${fund.dimension}`);
    getCombinedDataset(['Date'].concat(headers), responses, function(row) {
        console.log(row.join('\t'))
    });
});

function getCombinedDataset(headers, responses, mapper = function() {}) {
    mapper.call(null, headers);
    const allSeries = responses.map(series => series.data.r[0].t[0].d);
    const startMoment = allSeries
        .map(series => series[0].i)
        .map(rawDate => moment(rawDate))
        .reduce((curr, prev) => curr < prev ? curr : prev);
    const endMoment = allSeries
        .map(series => series[series.length - 1].i)
        .map(rawDate => moment(rawDate))
        .reduce((curr, prev) => curr > prev ? curr : prev);

    const currentPointers = responses.map(v => 0); // An array filled with zeroes
    let currentMoment = moment(startMoment); // clone
    do {
        const rowData = currentPointers.map((currentPointer, i) => {
            const data = allSeries[i][currentPointer];
            const dataMoment = moment(data.i);
            if (dataMoment.isSame(currentMoment)) {
                ++currentPointers[i];
                return parseFloat(data.v);
            } else {
                return '';
            }
        });

        const fullRowData = [currentMoment.format('MM/DD/YYYY')].concat(rowData);
        currentMoment.add(1, 'days');
        if (rowData.some(v => v)) {
            mapper.call(null, fullRowData);
        }
    } while (currentMoment.isBefore(endMoment))
}
