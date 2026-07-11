// Connector registry. Each entry is a standard OAuth2 authorization-code
// provider; the generic /api/connect/[provider]/{start,callback} routes handle
// the flow. A connector is "available" once its client id/secret env vars are
// set — until then the directory shows it as configurable, not broken.

export type Connector = {
  id: string;
  name: string;
  category: "Accounting" | "HR & Payroll" | "CRM" | "Comms" | "Scheduling" | "Productivity";
  blurb: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  tokenAuth: "basic" | "body"; // how the token endpoint authenticates the client
  idEnv: string;
  secretEnv: string;
};

export const connectors: Connector[] = [
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    category: "Accounting",
    blurb: "Invoices, bills, customers — AR/AP automation and reconciliation.",
    authUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    scope: "com.intuit.quickbooks.accounting openid",
    tokenAuth: "basic",
    idEnv: "QUICKBOOKS_CLIENT_ID",
    secretEnv: "QUICKBOOKS_CLIENT_SECRET",
  },
  {
    id: "xero",
    name: "Xero",
    category: "Accounting",
    blurb: "Invoices, contacts, and transactions for AR follow-up and books prep.",
    authUrl: "https://login.xero.com/identity/connect/authorize",
    tokenUrl: "https://identity.xero.com/connect/token",
    scope: "offline_access accounting.transactions accounting.contacts.read",
    tokenAuth: "basic",
    idEnv: "XERO_CLIENT_ID",
    secretEnv: "XERO_CLIENT_SECRET",
  },
  {
    id: "workday",
    name: "Workday",
    category: "HR & Payroll",
    blurb: "HR, payroll, and expenses. Tenant-specific — set WORKDAY_AUTH_URL.",
    authUrl: process.env.WORKDAY_AUTH_URL ?? "",
    tokenUrl: process.env.WORKDAY_TOKEN_URL ?? "",
    scope: "system",
    tokenAuth: "basic",
    idEnv: "WORKDAY_CLIENT_ID",
    secretEnv: "WORKDAY_CLIENT_SECRET",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM",
    blurb: "Contacts, deals, and companies for lead + revenue automation.",
    authUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scope: "crm.objects.contacts.read crm.objects.deals.read",
    tokenAuth: "body",
    idEnv: "HUBSPOT_CLIENT_ID",
    secretEnv: "HUBSPOT_CLIENT_SECRET",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Comms",
    blurb: "Post updates, alerts, and approvals into your channels.",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scope: "chat:write channels:read",
    tokenAuth: "body",
    idEnv: "SLACK_CLIENT_ID",
    secretEnv: "SLACK_CLIENT_SECRET",
  },
  {
    id: "google",
    name: "Google Workspace",
    category: "Productivity",
    blurb: "Gmail (read + draft) and Calendar for inbox and scheduling agents.",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events",
    tokenAuth: "body",
    idEnv: "GOOGLE_CLIENT_ID",
    secretEnv: "GOOGLE_CLIENT_SECRET",
  },
  {
    id: "calendly",
    name: "Calendly",
    category: "Scheduling",
    blurb: "Read events and create booking links for scheduling agents.",
    authUrl: "https://auth.calendly.com/oauth/authorize",
    tokenUrl: "https://auth.calendly.com/oauth/token",
    scope: "default",
    tokenAuth: "body",
    idEnv: "CALENDLY_CLIENT_ID",
    secretEnv: "CALENDLY_CLIENT_SECRET",
  },
];

export function getConnector(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}

export function getConnectorByName(name: string): Connector | undefined {
  return connectors.find((c) => c.name === name);
}

/** A connector is usable once its OAuth app credentials + endpoints are set. */
export function isConnectorConfigured(c: Connector): boolean {
  return Boolean(process.env[c.idEnv] && process.env[c.secretEnv] && c.authUrl && c.tokenUrl);
}
