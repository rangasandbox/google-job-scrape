async function scrapeJobListings(page) {
  try {
    const listingsContainerSelector = ".gws-plugins-horizon-jobs__tl-lvc";
    await page.waitForSelector(listingsContainerSelector, { timeout: 30000 });

    let lastJob = null;
    const filePath = path.join(__dirname, "jobs.json");
    let jobDetails = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, "utf8"))
      : [];

    while (true) {
      const jobListingsSelector = `${listingsContainerSelector} .gws-plugins-horizon-jobs__li-ed`;
      const listings = await page.$$(jobListingsSelector);

      if (listings.length === 0 || lastJob === listings[listings.length - 1]) {
        break;
      }

      for (const jobElement of listings) {
        const id = await jobElement.evaluate((el) =>
          el.getAttribute("data-ved")
        );

        const jobTitle = await jobElement.evaluate((el) => {
          const titleElement = el.querySelector(".BjJfJf"); // Adjust the selector as needed
          return titleElement
            ? titleElement.innerText.trim()
            : "No title found";
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
          2000
        );

        const company = await jobElement.evaluate(
          (el) => el.querySelector(".vNEEBe")?.innerText
        );
        const location = await jobElement.evaluate(
          (el) => el.querySelector(".Qk80Jf")?.innerText
        );

        const logo = await jobElement.evaluate(() => {
          // Trying to extract based on a specific size or class detail
          return (
            document.querySelector(
              'img[class="YQ4gaf zr758c"][height="56"][width="56"]'
            )?.src ||
            document.querySelector(
              'img[class="YQ4gaf zr758c wA1Bge"][height="40"][width="40"]'
            )?.src
          );
        });

        const postedDate = await jobElement.evaluate(
          () =>
            document.querySelector('.LL4CDc[aria-label*="Posted"]')?.textContent
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

        await rightSideElements.evaluate((element) => {
          // Find the button within the received element
          const showButton = element.querySelector('div[jsname="GTrWA"]');
          if (showButton) {
            showButton.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => showButton.click(), 500);
          }
        });

        const jobDescription = await rightSideElements.evaluate((element) => {
          // Find the description element within the sidebar
          const descriptionElement = element.querySelector(
            ".YgLbBe.YRi0le span.HBvzbc"
          );
          // Return the inner text of the description, or null if not found
          return descriptionElement
            ? descriptionElement.innerText.trim()
            : null;
        });

        if (!jobDetails.some((job) => job.id === id)) {
          jobDetails.push({
            id,
            jobTitle,
            logo,
            postedDate,
            salary,
            employmentType,
            company,
            location,
            jobDescription,
            applyUrls
          });
          fs.writeFileSync(filePath, JSON.stringify(jobDetails, null, 2));
        }

        // Use the alternative to waitForTimeout
        await page.evaluate(
          (time) => new Promise((resolve) => setTimeout(resolve, time)),
          1000
        );
      }

      lastJob = listings[listings.length - 1];
      await lastJob.evaluate((node) => node.scrollIntoView());

      // Use the alternative to waitForTimeout
      await page.evaluate(
        (time) => new Promise((resolve) => setTimeout(resolve, time)),
        2000
      );
    }

    return jobDetails;
  } catch (error) {
    console.error("Error scraping job listings:", error);
    throw new Error("Failed to scrape job listings");
  }
}
