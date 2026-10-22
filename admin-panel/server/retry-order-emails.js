
require("dotenv").config();

const {
  retryFailedOrderEmails,
} = require("./src/services/orderEmailService");

async function main() {
  try {
    const result = await retryFailedOrderEmails();

    console.log("Order email retry completed", result);

    process.exit(0);
  } catch (error) {
    console.error("Retry process failed:", error);
    process.exit(1);
  }
}

main();
