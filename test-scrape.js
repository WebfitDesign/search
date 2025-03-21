const puppeteer = require("puppeteer-extra")
const { v4: uuidv4 } = require("uuid")
const fs = require("fs")
const StealthPlugin = require("puppeteer-extra-plugin-stealth")

puppeteer.use(StealthPlugin())

// Scrape function for each website
// Modified scrape function with individual error handling for each field
async function scrapeSite(browser, url, selectors) {
  const page = await browser.newPage()
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

  try {
    console.log(`Navigating to ${url}...`)
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 5000 })

    // Wait for the title selector to load
    console.log("Waiting for title selector...")
    await page.waitForSelector(selectors.title, { timeout: 30000 })

    // check for green hosting
    const greenHostingFound = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase()
      return /100% renewable energy|green hosting/.test(bodyText)
    })

    const additionsOne = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase()
      return /money-back guarantee|money back guarantee/.test(bodyText)
    })

    const additionsTwo = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase()
      return /24\/7 support|24x7 support/.test(bodyText) // Escape the forward slash
    })

    const wordpressFound = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase()
      return /wordpress hosting|wordpress/.test(bodyText)
    })

    // Check if "automatic backups" or similar phrase is present on the page
    const backupFound = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase()
      return /automatic backups|daily backups|regular backups|automated backups|back ups|regular backups|daily back ups/.test(bodyText)
    })

    // // detect email box limit
    // const emailMailboxes = await page.$$eval(
    //   "*", // Capture all elements for maximum flexibility
    //   (elements) => {
    //     return elements
    //       .map((el) => el?.innerText?.trim()) // Use optional chaining to avoid errors
    //       .filter(Boolean) // Remove empty or undefined values
    //       .filter((text) => /(email|mailbox)/i.test(text)) // Match "email" or "mailbox"
    //   }
    // )

    // // console.log(emailMailboxes)

    // Extract the titles of all packages
    const packagesData = await page.$$eval(
      selectors.title,
      (elements, selectors, backupFound, greenHostingFound, wordpressFound, additionsOne, additionsTwo) => {
        // Define the estimateWebsiteLimit function inside the browser context
        function estimateWebsiteLimit(ssdStorage) {
          const storageValue = parseFloat(ssdStorage) // Extract numeric value
          if (isNaN(storageValue)) return "Unspecified"

          if (storageValue <= 30) {
            return "Unspecified, but Host Monster recommends approx 3-4 websites"
          } else if (storageValue <= 50) {
            return "Unspecified, but Host Monster recommends approx 5-7 websites"
          } else if (storageValue >= 100) {
            return "Unspecified, but suitable for multiple websites"
          }
          return "Unspecified"
        }

        console.log(`Inside $$eval, backupFound is: ${backupFound}`) // Debugging log
        return elements.map((el) => {
          // Select the closest container for the package using a dynamic selector from the website's selectors object
          const package = el.closest(selectors.packageContainer) || el // Fallback to self if parent not found
          // Dynamic package container

          // Function to safely extract data with error handling
          const getDetails = (selector) => {
            try {
              const element = package.querySelector(selector)
              return element ? element.innerText.trim() : " "
            } catch (error) {
              console.error(`Error extracting data for selector ${selector}:`, error)
              return " "
            }
          }

          // Improved logic for dealPrice extraction
          const hostPrice = getDetails(selectors.hostPrice)
          let dealPrice = getDetails(selectors.dealPrice)

          // Only keep dealPrice if it contains a currency symbol (like £, $, €)
          if (!/[£$€]/.test(dealPrice)) {
            dealPrice = ""
          }

          return {
            companyName: selectors.companyName || "N/A",
            companyLogo: selectors.companyLogo || "N/A",
            title: el.innerText.trim(),
            hostPrice,
            dealPrice,
            websiteLimit: getDetails(selectors.websiteLimit) !== " " ? getDetails(selectors.websiteLimit) : estimateWebsiteLimit(getDetails(selectors.ssdStorage)),
            mailboxLimit: getDetails(selectors.mailboxLimit),
            ssdStorage: getDetails(selectors.ssdStorage),
            freeDomains: getDetails(selectors.freeDomains),
            freeSsl: getDetails(selectors.freeSsl),
            backups: backupFound ? "Automatic backups" : "No backups found",
            greenHosting: greenHostingFound ? "Green Hosting" : " ",
            wordpress: wordpressFound ? "WordPress Hosting" : " ",
            additions1: additionsOne ? "Money-back Guarantee" : " ",
            additions2: additionsTwo ? "24/7 Support" : " ",
          }
        })
      },
      selectors,
      backupFound,
      greenHostingFound,
      wordpressFound,
      additionsOne,
      additionsTwo
    )

    return packagesData
  } catch (err) {
    console.error(`Error loading or extracting package data from ${url}:`, err)
    return null
  }
}

// Main function to scrape multiple websites and export to JSON
async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })

  const websites = [
    // Wordpress hosting packages
    {
      url: "https://www.20i.com/wordpress-hosting",
      selectors: {
        companyName: "20i",
        companyLogo: "https://www.20i.com/assets/images/20i-logo.svg",
        title: ".card-body .d-block.text-center", // Package titles
        packageContainer: ".card-body", // Package container selector (customized for this site)
        hostPrice: ".card-body .d-block.mx-auto.mb-1", // Host price selector
        dealPrice: ".card-body .d-block.text-center", // Deal price selector
        websiteLimit: ".card-body li:nth-child(1)", // Website limit selector
        mailboxLimit: ".card-body li:nth-child(4)", // Mailbox limit selector
        ssdStorage: ".card-body tr:nth-child(2)", // SSD storage selector
        freeDomains: "", // Free domains selector
        freeSsl: ".card-body li:nth-child(7)", // Free SSL selector
        backups: ".card-body .d-block.text-center", // Backups selector
        wordpress: "",
        greenHosting: ".card-body .d-block.text-center", // Green hosting selector
        additions1: "", // Additions1 selector
        additions2: "", // Additions2 selector
      },
    },

    {
      url: "https://www.webhosting.uk.com/wordpress-hosting",
      selectors: {
        companyName: "Web Hosting UK",
        companyLogo: "https://www.webhosting.uk.com/blog/wp-content/uploads/2021/12/Webhosting-UK.png",
        title: ".feature--pack .feature__title.h6", // Package titles
        packageContainer: ".feature--boxed", // Package container selector (customized for this site)
        hostPrice: ".feature--pack .price-value", // Host price selector
        dealPrice: " ", // Deal price selector
        websiteLimit: ".feature--pack .feature-name", // Website limit selector
        mailboxLimit: ".feature--pack ul:nth-child(8) ", // Mailbox limit selector
        ssdStorage: ".feature--pack ul:nth-child(6)", // SSD storage selector
        freeDomains: "", // Free domains selector
        freeSsl: ".feature--pack ul:nth-child(9)", // Free SSL selector
        backups: ".card-body .d-block.text-center", // Backups selector
        wordpress: "",
        greenHosting: ".card-body .d-block.text-center", // Green hosting selector
        additions1: "", // Additions1 selector
        additions2: "", // Additions2 selector
      },
    },

    {
      url: "https://www.fasthosts.co.uk/web-hosting/wordpress",
      selectors: {
        companyName: "Fasthosts",
        companyLogo: "https://ygo-assets-entities-emea.yougov.net/00a07d47-21f2-11e8-91d7-d17ce050fa91.jpg?ph=264",
        title: ".package__heading", // Package title
        packageContainer: ".package", // Package container
        hostPrice: ".package .package__pricing-then-text .vat-toggle-price-container", // Host price
        dealPrice: ".package .package__pricing ", // Deal price
        websiteLimit: ".package li:nth-child(1)",
        ssdStorage: ".package li:nth-child(2)", // SSD storage
        backups: ".package-wrapper .specs li:nth-child(4)", // Backups
        mailboxLimit: ".package__features-item:nth-of-type(5)", // Mailbox limit
        freeDomains: ".package__features-item:nth-of-type(6)", // Free domain
        freeSsl: ".package__features-item:nth-of-type(7)", // Free SSL
        greenHosting: ".card-body .d-block.text-center", // Green hosting selector
        wordpress: "",
        additions1: "", // Additions1 selector
        additions2: "", // Additions2 selector
      },
    },

    {
      url: "https://www.ukhost4u.com/wordpress-hosting-uk/",
      selectors: {
        companyName: "UK Host 4 U",
        companyLogo: "https://www.ukhost4u.com/wp-content/uploads/2019/04/logo.svg",
        title: ".tariff-list .item h3", // Package title
        packageContainer: ".item", // Package container
        hostPrice: ".tariff-list .item .price", // Host price
        dealPrice: "", // Deal price
        websiteLimit: ".item li:nth-child(1)",
        ssdStorage: ".item li:nth-child(2)", // SSD storage
        backups: "", // Backups
        mailboxLimit: ".item li:nth-child(3)", // Mailbox limit
        freeDomains: "", // Free domain
        freeSsl: ".item li:nth-child(12)", // Free SSL
        greenHosting: "", // Green hosting selector
        wordpress: "",
        additions1: "", // Additions1 selector
        additions2: "", // Additions2 selector
      },
    },

    {
      url: "https://www.names.co.uk/wordpress-hosting",
      selectors: {
        companyName: "Names.co.uk",
        companyLogo: "https://www.names.co.uk/images/namesco/site-wide/letter-domain-5e2102ade50b.svg",
        title: ".packages .package-wrapper>div .header3 span", // Package title
        packageContainer: ".on-sale, .off-sale", // Package container
        hostPrice: ".price", // Host price
        dealPrice: ".price-info", // Deal price
        websiteLimit: "",
        ssdStorage: ".specs li:nth-child(2)", // SSD storage
        backups: "", // Backups
        mailboxLimit: ".specs li:nth-child(6)", // Mailbox limit
        freeDomains: ".specs li:nth-child(7)", // Free domain
        freeSsl: ".specs li:nth-child(8)", // Free SSL
        greenHosting: "", // Green hosting selector
        wordpress: "",
        additions1: "", // Additions1 selector
        additions2: "", // Additions2 selector
      },
    },

    // {
    //   url: "https://www.hostinger.co.uk/wordpress-hosting",
    //   selectors: {
    //     companyName: "Hostinger",
    //     companyLogo: "https://www.drupal.org/files/Hostinger-logo.png",
    //     title: "", // Package title
    //     packageContainer: "", // Package container
    //     hostPrice: "", // Host price
    //     dealPrice: "", // Deal price
    //     websiteLimit: "",
    //     ssdStorage: "", // SSD storage
    //     backups: "", // Backups
    //     mailboxLimit: "", // Mailbox limit
    //     freeDomains: "", // Free domain
    //     freeSsl: "", // Free SSL
    //     greenHosting: "", // Green hosting selector
    //     wordpress: "",
    //     additions1: "", // Additions1 selector
    //     additions2: "", // Additions2 selector
    //   },
    // },

    // Wordpress hosting packages end
  ]

  const allPackages = []

  for (const site of websites) {
    console.log(`Starting scraping for: ${site.url}`)
    const packages = await scrapeSite(browser, site.url, site.selectors)

    if (packages) {
      allPackages.push(...packages)
      console.log(`Successfully found ${packages.length} packages for ${site.url}`)
    } else {
      console.log(`Failed to find packages for ${site.url}`)
    }
  }

  await browser.close()

  // Export the scraped packages to a JSON file
  fs.writeFileSync("testExport.json", JSON.stringify(allPackages, null, 2))
  console.log("Data successfully exported to testExport.json")
}

main()
