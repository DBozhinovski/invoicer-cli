import MicroInvoice from "@twosdai/microinvoice";

export async function generatePDF(invoiceData) {
  const myInvoice = new MicroInvoice(invoiceData);

  try {
    await myInvoice.generate(`./generated_invoices/${invoiceData.fileName}`);
    console.log(`Invoice saved as ${invoiceData.fileName}`);
  } catch (error) {
    console.error("Error generating PDF:", error);
  }
}
