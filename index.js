// const puppeteer = require("puppeteer");
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

// Launches the browser and sets up the page
async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: false,

    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--start-maximized", "--disable-setuid-sandbox"]
    // "--incognito"
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  return { browser, page };
}

function generateJobSearchUrl(location, role) {
  // Encode the role and location to ensure the URL is valid
  const encodedRole = encodeURIComponent(role);
  const encodedLocation = encodeURIComponent(location);

  // Construct the base URL for Google's job search
  const baseUrl = "https://www.google.com/search?";

  // Construct the query part of the URL with parameters for job search
  const query = `q=${encodedRole}+jobs+in+${encodedLocation}&ibp=htl;jobs&rciv=jb&chips=job_family_1:${encodedRole}`;

  // Return the complete URL
  return baseUrl + query;
}

async function extractPageData(page, jobElement) {
  // Extract
  const id = await jobElement.evaluate((el) => el.getAttribute("data-ved"));

  const jobTitle = await jobElement.evaluate((el) => {
    const titleElement = el.querySelector(".BjJfJf"); // Adjust the selector as needed
    return titleElement ? titleElement.innerText.trim() : "No title found";
  });

  await jobElement.evaluate((element) =>
    element.scrollIntoView({ behavior: "smooth", block: "center" })
  );

  await jobElement.click();

  await page.evaluate(
    (time) => new Promise((resolve) => setTimeout(resolve, time)),
    2000
  );

  const rightSideElements = await page.$("#tl_ditsc");
  // const RightSideElementsCode = await RightSideElements.evaluate(
  //   (el) => el.outerHTML
  // );

  // Use the alternative to waitForTimeout
  await page.evaluate(
    (time) => new Promise((resolve) => setTimeout(resolve, time)),
    1000
  );

  const company = await jobElement.evaluate(
    (el) => el.querySelector(".vNEEBe")?.innerText
  );
  const location = await jobElement.evaluate(
    (el) => el.querySelector(".Qk80Jf")?.innerText
  );

  const postedDate = await jobElement.evaluate(
    () => document.querySelector('.LL4CDc[aria-label*="Posted"]')?.textContent
  );
  const employmentType = await jobElement.evaluate(
    () =>
      document.querySelector('.LL4CDc[aria-label*="Employment type"]')
        ?.textContent
  );
  const salary = await jobElement.evaluate((el) => {
    const salaryElement = el.querySelector(".LL4CDc");
    return salaryElement?.innerText.trim();
  });
  // Get Link
  const applyUrls = await rightSideElements.evaluate((element) => {
    // Use querySelectorAll to find all <a> tags with the specific class within this element
    const links = Array.from(
      element.querySelectorAll("a.pMhGee.Co68jc.j0vryd")
    );
    // Map over each link to extract the href attribute
    return links.map((link) => link.href);
  });
  const imageSrc = await rightSideElements.evaluate((element) => {
    const image = element.querySelector(
      "div.ZUeoqc span.bBsnhf g-img.eZUcuf img"
    );
    return image?.src; // Return the image source or a default message if not found
  });

  const tryClickButton = async (selector) => {
    const button = await rightSideElements.$(selector);
    if (button) {
      await button.scrollIntoView({ behavior: "smooth", block: "center" });
      await page.waitForTimeout(500); // Ensure the UI has time to react
      await button.click();
      return true;
    }
    return false;
  };

  await rightSideElements.evaluate((element) => {
    const showButton = element.querySelector('div[jsname="GTrWA"]');
    if (showButton) {
      showButton.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => showButton.click(), 500);
    }
  });

  const jobDescription = await rightSideElements.evaluate((element) => {
    let descriptionElement = element.querySelector(
      ".YgLbBe.YRi0le span.HBvzbc"
    );
    if (descriptionElement) {
      return descriptionElement.innerText.trim();
    } else {
      // If not found, look for the alternative description
      descriptionElement = element.querySelector(
        "div.YgLbBe div[jscontroller='GCSbhd'] span.HBvzbc"
      );
      return descriptionElement?.innerText.trim();
    }
  });

  const highlight = await rightSideElements.evaluate((element) => {
    let highlight = element.querySelector(".ZHEsHe");
    if (highlight) {
      return highlight.innerText.trim();
    }
  });

  const jobData = {
    id,
    jobTitle,
    logo: imageSrc,
    postedDate,
    salary,
    employmentType,
    company,
    location,
    jobDescription,
    highlight,
    applyUrls
  };
  return jobData;
}

async function scrapeJobListings(page, browser) {
  try {
    const listingsContainerSelector = ".gws-plugins-horizon-jobs__tl-lvc";
    await page.waitForSelector(listingsContainerSelector, { timeout: 60000 });

    const filePath = path.join(__dirname, "jobs.json");
    let jobDetails = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, "utf8"))
      : [];

    const jobListingsSelector = `${listingsContainerSelector} .gws-plugins-horizon-jobs__li-ed`;

    // Scroll to the bottom of the container
    let lastHeight = await page.evaluate((selector) => {
      const container = document.querySelector(selector);
      return container.scrollHeight;
    }, listingsContainerSelector);

    while (true) {
      await page.evaluate((selector) => {
        const container = document.querySelector(selector);
        container.scrollTo(0, container.scrollHeight);
      }, listingsContainerSelector);

      await page.evaluate(
        (time) => new Promise((resolve) => setTimeout(resolve, time)),
        400
      );

      let newHeight = await page.evaluate((selector) => {
        const container = document.querySelector(selector);
        return container.scrollHeight;
      }, listingsContainerSelector);

      if (newHeight === lastHeight) {
        break; // Break the loop when scroll height does not change anymore
      }
      lastHeight = newHeight;
    }

    // After scrolling to the bottom, start scraping the data
    const listings = await page.$$(jobListingsSelector);
    for (const jobElement of listings) {
      const jobData = await extractPageData(page, jobElement);
      if (!jobDetails.some((job) => job.id === jobData.id)) {
        jobDetails.push(jobData);
        fs.writeFileSync(filePath, JSON.stringify(jobDetails, null, 2));
      }
    }
  } catch (error) {
    console.error("Error scraping job listings:", error);
    browser.close();
    throw error; // Rethrow the error after cleanup
  }
}

// Main function to start the automation
async function startAutomation() {
  const { browser, page } = await setupBrowser();
  try {
    // Navigate to the initial job page URL
    const url = generateJobSearchUrl("United States", "");
    console.log(url);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await scrapeJobListings(page, browser);
    // await browser.close();
  } catch (err) {
    console.error("Error running automation:", err);
    await browser.close();
    console.log("Browser automation disconnected.");
  }
}

startAutomation();
