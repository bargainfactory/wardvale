// Connector registry. Most entries are standard OAuth2 authorization-code
// providers; the generic /api/connect/[provider]/{start,callback} routes handle
// the flow. A few (Twilio, Stripe, Yelp) authenticate with API keys instead —
// those use tokenAuth "apikey" and the /api/connect/[provider]/key route, where
// the client pastes their own credentials. A connector is "available" once its
// OAuth app credentials (or, for apikey, always) are set — until then the
// directory shows it as configurable, not broken.

export type Category =
  | "Accounting"
  | "Payments"
  | "HR & Payroll"
  | "CRM"
  | "Comms"
  | "Support"
  | "Marketing"
  | "E-commerce"
  | "Field Service"
  | "Legal"
  | "Scheduling"
  | "Productivity";

export type KeyField = { name: string; label: string; placeholder?: string };

export type Connector = {
  id: string;
  name: string;
  category: Category;
  blurb: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  tokenAuth: "basic" | "body" | "apikey"; // how the token endpoint authenticates the client
  pkce?: boolean; // provider requires/prefers PKCE (S256)
  idEnv: string;
  secretEnv: string;
  keyFields?: KeyField[]; // apikey connectors: the credential(s) the client pastes
};

// Per-tenant hosts (Shopify, Zendesk, Gorgias) and env-switchable bases
// (DocuSign, Gusto, Workday) are read from env so the same registry entry works
// across tenants without code changes — mirrors the Workday pattern.
const shopifyShop = process.env.SHOPIFY_SHOP; // e.g. acme.myshopify.com
const zendeskSub = process.env.ZENDESK_SUBDOMAIN;
const gorgiasSub = process.env.GORGIAS_SUBDOMAIN;
const docusignBase = process.env.DOCUSIGN_AUTH_BASE ?? "https://account-d.docusign.com"; // demo default
const gustoBase = process.env.GUSTO_API_BASE ?? "https://api.gusto.com";

export const connectors: Connector[] = [
  // ── Accounting ────────────────────────────────────────────────────────────
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    category: "Accounting",
    blurb: "conn.quickbooksBlurb",
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
    blurb: "conn.xeroBlurb",
    authUrl: "https://login.xero.com/identity/connect/authorize",
    tokenUrl: "https://identity.xero.com/connect/token",
    scope: "offline_access accounting.transactions accounting.contacts.read",
    tokenAuth: "basic",
    idEnv: "XERO_CLIENT_ID",
    secretEnv: "XERO_CLIENT_SECRET",
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    blurb: "conn.stripeBlurb",
    authUrl: "",
    tokenUrl: "",
    scope: "",
    tokenAuth: "apikey",
    idEnv: "",
    secretEnv: "",
    keyFields: [{ name: "key", label: "conn.stripeKeyLabel", placeholder: "conn.stripeKeyPlaceholder" }],
  },

  // ── HR & Payroll ──────────────────────────────────────────────────────────
  {
    id: "workday",
    name: "Workday",
    category: "HR & Payroll",
    blurb: "conn.workdayBlurb",
    authUrl: process.env.WORKDAY_AUTH_URL ?? "",
    tokenUrl: process.env.WORKDAY_TOKEN_URL ?? "",
    scope: "system",
    tokenAuth: "basic",
    idEnv: "WORKDAY_CLIENT_ID",
    secretEnv: "WORKDAY_CLIENT_SECRET",
  },
  {
    id: "gusto",
    name: "Gusto",
    category: "HR & Payroll",
    blurb: "conn.gustoBlurb",
    authUrl: `${gustoBase}/oauth/authorize`,
    tokenUrl: `${gustoBase}/oauth/token`,
    scope: "",
    tokenAuth: "body",
    idEnv: "GUSTO_CLIENT_ID",
    secretEnv: "GUSTO_CLIENT_SECRET",
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM",
    blurb: "conn.hubspotBlurb",
    authUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scope: "crm.objects.contacts.read crm.objects.deals.read",
    tokenAuth: "body",
    idEnv: "HUBSPOT_CLIENT_ID",
    secretEnv: "HUBSPOT_CLIENT_SECRET",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "CRM",
    blurb: "conn.salesforceBlurb",
    authUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    scope: "api refresh_token",
    tokenAuth: "body",
    idEnv: "SALESFORCE_CLIENT_ID",
    secretEnv: "SALESFORCE_CLIENT_SECRET",
  },

  // ── Comms ─────────────────────────────────────────────────────────────────
  {
    id: "slack",
    name: "Slack",
    category: "Comms",
    blurb: "conn.slackBlurb",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scope: "chat:write channels:read",
    tokenAuth: "body",
    idEnv: "SLACK_CLIENT_ID",
    secretEnv: "SLACK_CLIENT_SECRET",
  },
  {
    id: "meta",
    name: "WhatsApp & Instagram (Meta)",
    category: "Comms",
    blurb: "conn.metaBlurb",
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scope:
      "pages_messaging,instagram_basic,instagram_manage_messages,whatsapp_business_messaging,pages_manage_metadata",
    tokenAuth: "body",
    idEnv: "META_CLIENT_ID",
    secretEnv: "META_CLIENT_SECRET",
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "Comms",
    blurb: "conn.twilioBlurb",
    authUrl: "",
    tokenUrl: "",
    scope: "",
    tokenAuth: "apikey",
    idEnv: "",
    secretEnv: "",
    keyFields: [
      { name: "key", label: "conn.twilioSidLabel", placeholder: "conn.twilioSidPlaceholder" },
      { name: "secret", label: "conn.twilioTokenLabel", placeholder: "conn.twilioTokenPlaceholder" },
      { name: "from", label: "conn.twilioFromLabel", placeholder: "conn.twilioFromPlaceholder" },
    ],
  },

  // ── Support ───────────────────────────────────────────────────────────────
  {
    id: "zendesk",
    name: "Zendesk",
    category: "Support",
    blurb: "conn.zendeskBlurb",
    authUrl: zendeskSub ? `https://${zendeskSub}.zendesk.com/oauth/authorizations/new` : "",
    tokenUrl: zendeskSub ? `https://${zendeskSub}.zendesk.com/oauth/tokens` : "",
    scope: "read write",
    tokenAuth: "body",
    idEnv: "ZENDESK_CLIENT_ID",
    secretEnv: "ZENDESK_CLIENT_SECRET",
  },
  {
    id: "gorgias",
    name: "Gorgias",
    category: "Support",
    blurb: "conn.gorgiasBlurb",
    authUrl: gorgiasSub ? `https://${gorgiasSub}.gorgias.com/oauth/authorize` : "",
    tokenUrl: gorgiasSub ? `https://${gorgiasSub}.gorgias.com/oauth/token` : "",
    scope: "openid email profile offline",
    tokenAuth: "body",
    idEnv: "GORGIAS_CLIENT_ID",
    secretEnv: "GORGIAS_CLIENT_SECRET",
  },
  {
    id: "intercom",
    name: "Intercom",
    category: "Support",
    blurb: "conn.intercomBlurb",
    authUrl: "https://app.intercom.com/oauth",
    tokenUrl: "https://api.intercom.io/auth/eagle/token",
    scope: "",
    tokenAuth: "body",
    idEnv: "INTERCOM_CLIENT_ID",
    secretEnv: "INTERCOM_CLIENT_SECRET",
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    id: "google-business",
    name: "Google Business Profile",
    category: "Marketing",
    blurb: "conn.googleBusinessBlurb",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/business.manage",
    tokenAuth: "body",
    idEnv: "GOOGLE_CLIENT_ID",
    secretEnv: "GOOGLE_CLIENT_SECRET",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "Marketing",
    blurb: "conn.mailchimpBlurb",
    authUrl: "https://login.mailchimp.com/oauth2/authorize",
    tokenUrl: "https://login.mailchimp.com/oauth2/token",
    scope: "",
    tokenAuth: "body",
    idEnv: "MAILCHIMP_CLIENT_ID",
    secretEnv: "MAILCHIMP_CLIENT_SECRET",
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    category: "Marketing",
    blurb: "conn.klaviyoBlurb",
    authUrl: "https://www.klaviyo.com/oauth/authorize",
    tokenUrl: "https://a.klaviyo.com/oauth/token",
    scope: "accounts:read campaigns:read profiles:read profiles:write",
    tokenAuth: "basic",
    pkce: true,
    idEnv: "KLAVIYO_CLIENT_ID",
    secretEnv: "KLAVIYO_CLIENT_SECRET",
  },
  {
    id: "yelp",
    name: "Yelp",
    category: "Marketing",
    blurb: "conn.yelpBlurb",
    authUrl: "",
    tokenUrl: "",
    scope: "",
    tokenAuth: "apikey",
    idEnv: "",
    secretEnv: "",
    keyFields: [{ name: "key", label: "conn.yelpKeyLabel", placeholder: "conn.yelpKeyPlaceholder" }],
  },

  // ── E-commerce ────────────────────────────────────────────────────────────
  {
    id: "shopify",
    name: "Shopify",
    category: "E-commerce",
    blurb: "conn.shopifyBlurb",
    authUrl: shopifyShop ? `https://${shopifyShop}/admin/oauth/authorize` : "",
    tokenUrl: shopifyShop ? `https://${shopifyShop}/admin/oauth/access_token` : "",
    scope: "read_orders,read_customers,write_customers,read_products",
    tokenAuth: "body",
    idEnv: "SHOPIFY_CLIENT_ID",
    secretEnv: "SHOPIFY_CLIENT_SECRET",
  },
  {
    id: "square",
    name: "Square",
    category: "E-commerce",
    blurb: "conn.squareBlurb",
    authUrl: "https://connect.squareup.com/oauth2/authorize",
    tokenUrl: "https://connect.squareup.com/oauth2/token",
    scope: "ORDERS_READ CUSTOMERS_READ CUSTOMERS_WRITE PAYMENTS_READ",
    tokenAuth: "body",
    idEnv: "SQUARE_CLIENT_ID",
    secretEnv: "SQUARE_CLIENT_SECRET",
  },

  // ── Field Service ─────────────────────────────────────────────────────────
  {
    id: "jobber",
    name: "Jobber",
    category: "Field Service",
    blurb: "conn.jobberBlurb",
    authUrl: "https://api.getjobber.com/api/oauth/authorize",
    tokenUrl: "https://api.getjobber.com/api/oauth/token",
    scope: "read write",
    tokenAuth: "body",
    idEnv: "JOBBER_CLIENT_ID",
    secretEnv: "JOBBER_CLIENT_SECRET",
  },

  // ── Legal ─────────────────────────────────────────────────────────────────
  {
    id: "clio",
    name: "Clio",
    category: "Legal",
    blurb: "conn.clioBlurb",
    authUrl: "https://app.clio.com/oauth/authorize",
    tokenUrl: "https://app.clio.com/oauth/token",
    scope: "",
    tokenAuth: "body",
    idEnv: "CLIO_CLIENT_ID",
    secretEnv: "CLIO_CLIENT_SECRET",
  },

  // ── Productivity ──────────────────────────────────────────────────────────
  {
    id: "google",
    name: "Google Workspace",
    category: "Productivity",
    blurb: "conn.googleBlurb",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events",
    tokenAuth: "body",
    idEnv: "GOOGLE_CLIENT_ID",
    secretEnv: "GOOGLE_CLIENT_SECRET",
  },
  {
    id: "microsoft",
    name: "Microsoft 365",
    category: "Productivity",
    blurb: "conn.microsoftBlurb",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "offline_access User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Chat.ReadWrite",
    tokenAuth: "body",
    idEnv: "MICROSOFT_CLIENT_ID",
    secretEnv: "MICROSOFT_CLIENT_SECRET",
  },
  {
    id: "docusign",
    name: "DocuSign",
    category: "Productivity",
    blurb: "conn.docusignBlurb",
    authUrl: `${docusignBase}/oauth/auth`,
    tokenUrl: `${docusignBase}/oauth/token`,
    scope: "signature",
    tokenAuth: "basic",
    idEnv: "DOCUSIGN_CLIENT_ID",
    secretEnv: "DOCUSIGN_CLIENT_SECRET",
  },
  {
    id: "calendly",
    name: "Calendly",
    category: "Scheduling",
    blurb: "conn.calendlyBlurb",
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

/**
 * A connector is usable once it's ready to connect. API-key connectors are
 * always ready — the client supplies their own key at connect time. OAuth
 * connectors need their app credentials + endpoints set.
 */
export function isConnectorConfigured(c: Connector): boolean {
  if (c.tokenAuth === "apikey") return true;
  return Boolean(process.env[c.idEnv] && process.env[c.secretEnv] && c.authUrl && c.tokenUrl);
}
