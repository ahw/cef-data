#!/Users/andrew/.nvm/versions/node/v8.11.2/bin/node
const Promise = require('bluebird');
const rp = require('request-promise');
const moment = require('moment');

function getUrl(params) {
    return `http://mschart.morningstar.com/chartweb/defaultChart`;
}

function getQueryString(params) {
    const { secid, price, nav } = params;
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
        'Cookie': 'fp=015153493849911286; AMCVS_54E6587D53EB65370A490D4B%40AdobeOrg=1; __utmc=172984700; s_cc=true; mid=8477631990408306469; ScrollY=0; mint=V151CD4DC950843A6B2C5F2D5E3B6B45C1437B3C7553882F6668982960518552CE56A82BA73364659A4D805E973F75285D51835588285F51885BD762942CA8A3AA7C21F19C3C3BC3C1693A70BCCC8A; _ga=GA1.2.1875053046.1534938502; _gcl_au=1.1.1525788025.1540982937; __utmz=172984700.1541731046.7.6.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); AMCV_54E6587D53EB65370A490D4B%40AdobeOrg=-1303530583%7CMCIDTS%7C17847%7CMCMID%7C42567212183977378472563193384217973282%7CMCAAMLH-1542549960%7C7%7CMCAAMB-1542549960%7CRKhpRz8krg2tLO6pguXWp5olkAcUniQYPHaMWWgdJ3xzPWQmdj0y%7CMCOPTOUT-1541952360s%7CNONE%7CMCAID%7CNONE%7CMCSYNCSOP%7C411-17785%7CvVersion%7C3.3.0; check=true; mbox=PC#8d33f455fc6149e38bf5720b4ca4049c.17_6#1542941243|session#e36d2dc5060349e1b05632600002add0#1541947960; Hint=i-0e9ac9a671fb6315e; __utma=172984700.1875053046.1534938502.1542107018.1542200543.10; __utmt=1; __utmb=172984700.1.10.1542200543',
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
    printCombinedDataset(['Date'].concat(headers), responses);
});

function printCombinedDataset(headers, responses) {
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
    const columns = [];
    let currentMoment = moment(startMoment); // clone
    console.log(headers.join('\t'));
    do {
        const column = currentPointers.map((currentPointer, i) => {
            const data = allSeries[i][currentPointer];
            const dataMoment = moment(data.i);
            if (dataMoment.isSame(currentMoment)) {
                ++currentPointers[i];
                return parseFloat(data.v);
            } else {
                // console.log(`data for date ${data.i} does not match current moment ${currentMoment}; skipping`);
                return '';
            }
        });

        const fullColumn = [currentMoment.format('MM/DD/YYYY')].concat(column);
        currentMoment.add(1, 'days');
        if (column.some(v => v)) {
            console.log(fullColumn.join('\t'));
        }
    } while (currentMoment.isBefore(endMoment))
}
