const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
require("dotenv").config();

// Initialize credentials
const credential = new ClientSecretCredential(
  process.env.OFFICE365_TENANT_ID,
  process.env.OFFICE365_CLIENT_ID,
  process.env.OFFICE365_CLIENT_SECRET
);

// Create a Microsoft Graph client
const client = Client.initWithMiddleware({
  authProvider: {
    getAccessToken: async () => {
      const token = await credential.getToken(
        "https://graph.microsoft.com/.default"
      );
      return token.token;
    },
  },
});

// Fetch calendar events
async function getCalendarEvents() {
  try {
    const events = await client
      .api("/me/events")
      .select("subject,start,end,location")
      .orderby("start/dateTime")
      .get();
    return events.value;
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    throw error;
  }
}

module.exports = { getCalendarEvents };
