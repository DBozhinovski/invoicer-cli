import inquirer from "inquirer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { generatePDF } from "./src/generatePDF.mjs";
import { formatDate, generateInvoiceNumber } from "./src/utils.mjs";
import { writeFile, mkdir, readdir, readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = process.cwd();
const INVOICES_DIR = path.join(PROJECT_ROOT, "invoices");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "generated_invoices");

const SELLER_INFO = [
  {
    label: "From",
    value: ["YOUR NAME", "YOUR ADDRESS"],
  },
  {
    label: "RELEVANT REGISTRATION NUMBER",
    value: "YOUR REGISTRATION NUMBER",
  },
  {
    label: "Bank Account",
    value: "YOUR BANK ACCOUNT",
  },
];

async function main() {
  await ensureOutputDirectoryExists();

  while (true) {
    const { action } = await inquirer.prompt({
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: "Create a new invoice", value: "create" },
        { name: "Generate PDF for a single invoice", value: "generateSingle" },
        {
          name: "Generate PDFs for all existing invoices",
          value: "generateAll",
        },
        { name: "Exit", value: "exit" },
      ],
    });

    switch (action) {
      case "create":
        await createNewInvoice();
        break;
      case "generateSingle":
        await selectAndGenerateInvoice();
        break;
      case "generateAll":
        await generateAllInvoices();
        break;
      case "exit":
        console.log("Goodbye!");
        process.exit(0);
    }
  }
}

async function createNewInvoice() {
  const { companyName } = await inquirer.prompt({
    type: "input",
    name: "companyName",
    message: "Enter the company name:",
  });

  const today = new Date();
  const invoiceDate = formatDate(today);
  const invoiceNumber = generateInvoiceNumber(today);

  const invoiceData = {
    fileName: `${companyName.toLowerCase().replace(/\s+/g, "-")}-invoice.pdf`,
    data: {
      invoice: {
        name: "INVOICE",
        header: [
          { label: "number", value: invoiceNumber },
          { label: "issue date", value: invoiceDate },
        ],
        currency: "$",
        customer: await promptForCustomerData(),
        seller: SELLER_INFO,
        details: await promptForInvoiceDetails(),
      },
    },
  };

  const pdfPath = path.join(OUTPUT_DIR, invoiceData.fileName);
  const jsonPath = path.join(
    INVOICES_DIR,
    invoiceData.fileName.replace(".pdf", ".json")
  );

  await generatePDF(invoiceData.data, pdfPath);
  await writeFile(jsonPath, JSON.stringify(invoiceData, null, 2));

  console.log(`Invoice generated: ${pdfPath}`);
  console.log(`JSON data saved: ${jsonPath}`);
}

async function promptForCustomerData() {
  return [
    {
      label: "To",
      value: [
        await promptForValue("Enter customer name:"),
        await promptForValue("Enter customer address:"),
      ],
    },
    { label: "Customer ID", value: await promptForValue("Enter customer ID:") },
  ];
}

async function promptForInvoiceDetails() {
  const details = {
    header: [
      { value: "Description" },
      { value: "Quantity" },
      { value: "Total" },
    ],
    parts: [],
    total: [],
  };

  while (true) {
    const { addMore } = await inquirer.prompt({
      type: "confirm",
      name: "addMore",
      message: "Add an invoice item?",
      default: true,
    });

    if (!addMore) break;

    const item = [
      { value: await promptForValue("Enter item description:") },
      { value: parseInt(await promptForValue("Enter quantity:")) },
      {
        value: await promptForValue("Enter total price (in Dollars):"),
        price: true,
      },
    ];
    details.parts.push(item);
  }

  const total = details.parts.reduce(
    (sum, item) => sum + parseFloat(item[2].value),
    0
  );

  details.total = [{ label: "Total", value: total.toFixed(2), price: true }];

  return details;
}

async function printExistingInvoice() {
  const files = await fs.readdir(INVOICES_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  if (jsonFiles.length === 0) {
    console.log("No existing invoices found.");
    return;
  }

  const { selectedFile } = await inquirer.prompt({
    type: "list",
    name: "selectedFile",
    message: "Select an invoice to print:",
    choices: jsonFiles,
  });

  const invoiceData = JSON.parse(
    await fs.readFile(path.join(INVOICES_DIR, selectedFile), "utf-8")
  );
  await generatePDF(invoiceData);
  console.log(`Invoice printed: ${invoiceData.fileName}`);
}

async function promptForValue(message) {
  const { value } = await inquirer.prompt({
    type: "input",
    name: "value",
    message,
  });
  return value;
}

async function ensureOutputDirectoryExists() {
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

async function generateAllInvoices() {
  const files = await readdir(INVOICES_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  for (const file of jsonFiles) {
    await generateInvoicePDF(file);
  }
}

async function generateInvoicePDF(file) {
  const content = await readFile(path.join(INVOICES_DIR, file), "utf-8");
  const invoiceData = JSON.parse(content);

  await generatePDF(invoiceData);
}

async function selectAndGenerateInvoice() {
  const files = await readdir(INVOICES_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  const { selectedFile } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedFile",
      message: "Select an invoice to generate:",
      choices: jsonFiles,
    },
  ]);

  await generateInvoicePDF(selectedFile);
}

main().catch(console.error);
