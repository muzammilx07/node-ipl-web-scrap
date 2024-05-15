const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

let scrapedData = {};

async function writeToLog(data) {
  try {
    data = "\n" + data;
    await fs.promises.appendFile('consoleLog.txt', data);
    return true;
  } catch (error) {
    console.log('Error writing to console log file:', error);
    return false;
  }
}

let delay = (ms) => new Promise((resolve, reject) => {
  setTimeout(() => { resolve() }, ms);
});

async function start() {
  const browser = await puppeteer.launch({ headless: false });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const years = [2020, 2021, 2022, 2023, 2024];

    for (const year of years) {
      const URL = `https://www.iplt20.com/stats/${year}`;
      await page.goto(URL);

      const data = {};

      // Extract data for Orange Cap
      data['Orange Cap'] = await extractData(page, 'Orange Cap');

      // Extract data for Most Fours
      data['Most Fours'] = await extractData(page, 'Most Fours (Innings)');

      // Extract data for Most Sixes
      data['Most Sixes'] = await extractData(page, 'Most Sixes (Innings)');

      // Extract data for Most Centuries
      data['Most Centuries'] = await extractData(page, 'Most Centuries');

      // Extract data for Most Fifties
      data['Most Fifties'] = await extractData(page, 'Fastest Fifties');

      scrapedData[year] = data;
    }

    console.log(scrapedData);
    writeToFile('data.json', scrapedData);

  } catch (error) {
    console.log('There is an error:', error);
  } finally {
    setTimeout(async () => {
      await browser.close();
    }, 5000);
  }
}

async function click(page, filterName) {
  const filterMenu = 'div.col-lg-3.col-md-3.col-sm-12.statsFilter';
  await page.waitForSelector(filterMenu);
  await page.click(filterMenu);

  const filterItems = await page.$$('div.cSBList >>> div.cSBListItems.batters.selected.ng-binding.ng-scope');
  for (const item of filterItems) {
    const isClicked = await page.evaluate(async (element, filterName) => {
      if (element.textContent.includes(filterName)) {
        element.click();
        return true;
      }
      return false;
    }, item, filterName);
    if (isClicked) {
      break;
    }
  }
}

async function extractData(page, filterName) {
  await click(page, filterName);
  const tableSelector = 'table.st-table.statsTable.ng-scope';
  return await extractTableData(tableSelector, page);
}

async function extractTableData(tableSelector, page) {
  await page.waitForSelector(tableSelector);
  await delay(1000);
  const tableRows = await page.$$(tableSelector + ' tr');
  const extractedData = [];
  const maxRows = Math.min(tableRows.length, 11);
  for (let i = 0; i < maxRows; i++) {
    const row = tableRows[i];
    const rowData = await page.evaluate(row => {
      const isHeader = row.querySelectorAll('th').length > 0;
      const columns = isHeader ? row.querySelectorAll('th') : row.querySelectorAll('td');
      const data = Array.from(columns, column => column.textContent.trim());
      let imageUrl = "";
      if (!isHeader) {
        const imgElement = row.querySelector('div.pbi > img');
        imageUrl = imgElement ? imgElement.getAttribute('src') : "";
      }
      data.push(imageUrl);
      return data;
    }, row);
    extractedData.push(rowData);
  }
  return extractedData;
}

async function writeToFile(fileName, data) {
  try {
    const directory = 'ExtractedData';
    try {
      await fs.promises.access(directory);
    } catch (error) {
      await fs.promises.mkdir(directory);
    }
    const filePath = path.join(directory, fileName);
    const jsonData = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, jsonData, 'utf-8');
    console.log(`Data successfully written into file: ${fileName}!`);
  } catch (error) {
    console.log(`Error writing data to file: ${fileName}! (${error.message})`);
  }
}
start();
