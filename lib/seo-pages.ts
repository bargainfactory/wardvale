export type SeoPage = {
  slug: string;
  vertical: string;
  workflow: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  problem: string;
  solution: string;
  steps: { label: string; tool: string }[];
  tools: string[];
  savings: string;
};

export const seoPages: SeoPage[] = [
  {
    slug: "restaurant-reservation-and-review-agent",
    vertical: "Restaurant",
    workflow: "Reservation & review agent",
    h1: "Automated reservation and review agent for restaurants",
    metaTitle: "Restaurant Reservation & Review Automation | FlowForge AI",
    metaDescription:
      "Fill more tables and earn more 5-star reviews on autopilot. FlowForge books reservations, confirms guests, and requests reviews from happy diners automatically.",
    problem:
      "Phones ring during the dinner rush and reservations slip through the cracks while your team is plating orders. No-shows leave empty tables you could have filled, and the guests who loved their meal walk out without ever leaving a review. Chasing feedback by hand is the first thing that gets dropped on a busy night.",
    solution:
      "FlowForge deploys an AI reservation agent that answers booking requests across your website, SMS, and social DMs, then writes each confirmed table straight into your calendar. It sends smart reminders to cut no-shows, and after the meal it texts happy guests a one-tap link to leave a Google review while the experience is still fresh.",
    steps: [
      { label: "Guest requests a table", tool: "GPT agent" },
      { label: "Book & confirm the reservation", tool: "Calendly" },
      { label: "Send reminder to cut no-shows", tool: "Twilio" },
      { label: "Request a review post-visit", tool: "Gmail" },
    ],
    tools: ["GPT agent", "Calendly", "Twilio", "Gmail", "Google Reviews"],
    savings: "~$2,400/mo",
  },
  {
    slug: "shopify-store-abandoned-cart-recovery",
    vertical: "Shopify store",
    workflow: "Abandoned cart recovery",
    h1: "Abandoned cart recovery automation for Shopify stores",
    metaTitle: "Shopify Abandoned Cart Recovery Automation | FlowForge AI",
    metaDescription:
      "Win back the 70% of shoppers who abandon their carts. FlowForge sends perfectly timed, personalized recovery emails and texts that convert on autopilot.",
    problem:
      "Roughly seven in ten shoppers add products to their cart and leave without buying. Generic one-size-fits-all reminder emails feel like spam and get ignored, and most stores never follow up by SMS at all. Every abandoned cart is revenue you already earned the click for, quietly leaking away.",
    solution:
      "FlowForge watches your Shopify checkout events and launches a personalized recovery sequence the moment a cart goes cold. An AI agent writes copy referencing the exact items left behind, layers in an optional incentive, and follows up across email and SMS at the times most likely to convert, then stops the instant the order completes.",
    steps: [
      { label: "Detect the abandoned cart", tool: "Shopify" },
      { label: "Draft a personalized win-back message", tool: "GPT agent" },
      { label: "Send timed email + SMS sequence", tool: "Twilio" },
      { label: "Track recovery & stop on purchase", tool: "Sheets" },
    ],
    tools: ["Shopify", "GPT agent", "Twilio", "Gmail", "Sheets"],
    savings: "~$3,800/mo",
  },
  {
    slug: "plumbing-missed-call-to-booked-job",
    vertical: "Plumbing",
    workflow: "Missed call to booked job",
    h1: "Turn every missed call into a booked job for plumbers",
    metaTitle: "Plumbing Missed-Call-to-Booked-Job Automation | FlowForge AI",
    metaDescription:
      "Stop losing jobs to voicemail. FlowForge instantly texts back missed callers, qualifies the emergency, and books the appointment before your competitor calls them.",
    problem:
      "You are under a sink or driving between jobs when the phone rings, and a customer with a burst pipe goes straight to voicemail. Most people never leave a message; they simply call the next plumber on the list. Every missed call is a booked job handed to a competitor.",
    solution:
      "FlowForge fires an instant text-back the second you miss a call, so the customer knows you are on it. An AI agent asks a few qualifying questions, gauges urgency, and offers real open slots from your calendar, booking the job and collecting the address and problem details before you even wipe your hands.",
    steps: [
      { label: "Detect the missed call", tool: "Twilio" },
      { label: "Auto text-back the caller", tool: "Twilio" },
      { label: "Qualify the job & urgency", tool: "GPT agent" },
      { label: "Book the appointment", tool: "Calendly" },
    ],
    tools: ["Twilio", "GPT agent", "Calendly", "Sheets"],
    savings: "~$5,200/mo",
  },
  {
    slug: "real-estate-lead-qualification-and-follow-up",
    vertical: "Real estate",
    workflow: "Lead qualification & follow-up",
    h1: "Lead qualification and follow-up automation for real estate",
    metaTitle: "Real Estate Lead Qualification & Follow-Up Automation | FlowForge AI",
    metaDescription:
      "Respond to every lead in seconds and never let a warm buyer go cold. FlowForge qualifies inquiries, books showings, and nurtures prospects automatically.",
    problem:
      "Portal and website leads expect an answer in minutes, but you are showing homes and closing deals when they come in. By the time you circle back, the buyer has already engaged three other agents. Manual follow-up drip is inconsistent, so warm prospects quietly go cold in your inbox.",
    solution:
      "FlowForge responds to new leads instantly, day or night, with an AI agent that asks about budget, timeline, financing, and location, then scores each prospect. Qualified buyers get a showing booked on your calendar automatically, while everyone else drops into a long-term nurture sequence that keeps you top of mind until they are ready.",
    steps: [
      { label: "Capture the inbound lead", tool: "Sheets" },
      { label: "Qualify budget, timeline & intent", tool: "GPT agent" },
      { label: "Book a showing for hot leads", tool: "Calendly" },
      { label: "Nurture the rest over time", tool: "Gmail" },
    ],
    tools: ["GPT agent", "Calendly", "Gmail", "Twilio", "Sheets"],
    savings: "~$4,600/mo",
  },
  {
    slug: "dental-practice-appointment-reminders-and-rebooking",
    vertical: "Dental practice",
    workflow: "Appointment reminders & rebooking",
    h1: "Appointment reminder and rebooking automation for dental practices",
    metaTitle: "Dental Appointment Reminder & Rebooking Automation | FlowForge AI",
    metaDescription:
      "Slash no-shows and fill your chairs. FlowForge sends smart reminders, rebooks cancellations, and brings lapsed patients back for cleanings automatically.",
    problem:
      "Empty chairs from no-shows and last-minute cancellations cost your practice hundreds of dollars a day, and your front desk is too swamped to chase them. Patients who are overdue for a cleaning drift away because no one has time to call them. Every gap in the schedule is lost production you can never recover.",
    solution:
      "FlowForge sends multi-touch appointment reminders by text and email that let patients confirm, cancel, or reschedule with one tap. When a slot opens, it automatically offers it to your waitlist, and it runs recall campaigns that invite overdue patients to rebook their hygiene visits, keeping your schedule full without extra front-desk work.",
    steps: [
      { label: "Sync upcoming appointments", tool: "Calendly" },
      { label: "Send confirm / reschedule reminders", tool: "Twilio" },
      { label: "Offer open slots to the waitlist", tool: "GPT agent" },
      { label: "Recall overdue patients", tool: "Gmail" },
    ],
    tools: ["Calendly", "Twilio", "GPT agent", "Gmail", "Sheets"],
    savings: "~$3,100/mo",
  },
  {
    slug: "consulting-proposal-to-onboarding-autopilot",
    vertical: "Consulting",
    workflow: "Proposal to onboarding autopilot",
    h1: "Proposal-to-onboarding autopilot for consultants",
    metaTitle: "Consulting Proposal & Client Onboarding Automation | FlowForge AI",
    metaDescription:
      "Go from signed proposal to kicked-off engagement without lifting a finger. FlowForge sends contracts, collects payment, and onboards new clients automatically.",
    problem:
      "Closing the deal is only half the battle; the handoff from yes to kickoff is a maze of contracts, invoices, intake forms, and welcome emails. Doing it by hand is slow and error-prone, and a clumsy start undermines the confidence a new client just placed in you. Every hour spent on admin is an hour you are not billing.",
    solution:
      "FlowForge turns a signed proposal into a fully automated onboarding flow. The moment a client accepts, it sends the contract for e-signature, issues the deposit invoice, delivers the intake questionnaire, and drops the kickoff meeting on both calendars, so your engagement starts crisp and professional while you stay focused on the work.",
    steps: [
      { label: "Proposal accepted", tool: "GPT agent" },
      { label: "Send contract & collect deposit", tool: "Stripe" },
      { label: "Deliver intake questionnaire", tool: "Sheets" },
      { label: "Schedule the kickoff call", tool: "Calendly" },
    ],
    tools: ["GPT agent", "Stripe", "Calendly", "Gmail", "Sheets"],
    savings: "~$2,900/mo",
  },
  {
    slug: "gym-fitness-membership-onboarding-and-winback",
    vertical: "Gym & fitness",
    workflow: "Membership onboarding & win-back",
    h1: "Membership onboarding and win-back automation for gyms",
    metaTitle: "Gym Membership Onboarding & Win-Back Automation | FlowForge AI",
    metaDescription:
      "Turn new sign-ups into loyal members and win back the ones drifting away. FlowForge automates onboarding, check-ins, and at-risk member re-engagement.",
    problem:
      "New members are most likely to quit in their first month, yet onboarding usually stops at a welcome email. Meanwhile, members who stop showing up churn silently, and by the time you notice on the billing report they are already gone. Manually tracking attendance and following up is impossible at scale.",
    solution:
      "FlowForge builds a guided onboarding journey that books each new member's first session, checks in over their first weeks, and celebrates early wins to build the habit. It watches attendance for drop-off, and when a member goes quiet it triggers a personal win-back message with an incentive to return, saving memberships before they cancel.",
    steps: [
      { label: "New member signs up", tool: "Sheets" },
      { label: "Book first session & welcome series", tool: "GPT agent" },
      { label: "Monitor attendance for drop-off", tool: "Sheets" },
      { label: "Trigger win-back to at-risk members", tool: "Twilio" },
    ],
    tools: ["GPT agent", "Twilio", "Gmail", "Calendly", "Sheets"],
    savings: "~$3,400/mo",
  },
  {
    slug: "law-firm-intake-and-document-collection",
    vertical: "Law firm",
    workflow: "Intake & document collection",
    h1: "Client intake and document collection automation for law firms",
    metaTitle: "Law Firm Intake & Document Collection Automation | FlowForge AI",
    metaDescription:
      "Onboard clients faster and collect every document without the back-and-forth. FlowForge automates intake, conflict checks, and secure file gathering.",
    problem:
      "New client intake buries your team in questionnaires, conflict checks, engagement letters, and endless emails asking for missing paperwork. Prospects lose patience during a slow start, and paralegals burn billable hours chasing documents that clients forget to send. The friction costs you both cases and margin.",
    solution:
      "FlowForge runs a structured intake flow that collects client details, screens for conflicts, and sends the engagement letter for signature automatically. It then requests each required document with a secure upload link and sends polite, persistent reminders until every file is in, so your matter opens quickly and your staff stops playing document detective.",
    steps: [
      { label: "Capture intake details", tool: "GPT agent" },
      { label: "Run conflict check & log matter", tool: "Sheets" },
      { label: "Send engagement letter to sign", tool: "Gmail" },
      { label: "Collect documents with reminders", tool: "Twilio" },
    ],
    tools: ["GPT agent", "Gmail", "Twilio", "Sheets", "Stripe"],
    savings: "~$4,100/mo",
  },
  {
    slug: "ecommerce-customer-support-inbox-triage",
    vertical: "Ecommerce",
    workflow: "Customer support inbox triage",
    h1: "Customer support inbox triage automation for ecommerce",
    metaTitle: "Ecommerce Support Inbox Triage Automation | FlowForge AI",
    metaDescription:
      "Answer 'where is my order?' in seconds and route the rest to the right place. FlowForge triages your support inbox and drafts on-brand replies automatically.",
    problem:
      "Your support inbox floods with the same questions: order status, returns, sizing, and refunds. Agents copy-paste answers all day while genuinely urgent tickets wait in the same queue as routine ones. Slow replies tank your CSAT and quietly push customers toward competitors.",
    solution:
      "FlowForge reads every incoming message, tags it by intent and urgency, and pulls live order data to answer common questions like shipping status instantly. For anything needing a human, it drafts an on-brand reply and routes the ticket to the right agent with full context, so your team clears the queue in a fraction of the time.",
    steps: [
      { label: "Receive a support message", tool: "Gmail" },
      { label: "Classify intent & urgency", tool: "GPT agent" },
      { label: "Pull order data & auto-answer", tool: "Shopify" },
      { label: "Draft reply & route to an agent", tool: "Sheets" },
    ],
    tools: ["Gmail", "GPT agent", "Shopify", "Sheets", "Twilio"],
    savings: "~$4,900/mo",
  },
  {
    slug: "home-services-quote-follow-up-and-review-requests",
    vertical: "Home services",
    workflow: "Quote follow-up & review requests",
    h1: "Quote follow-up and review request automation for home services",
    metaTitle: "Home Services Quote Follow-Up & Review Automation | FlowForge AI",
    metaDescription:
      "Close more estimates and stack up 5-star reviews. FlowForge follows up on every quote and asks happy customers for reviews automatically.",
    problem:
      "You send an estimate for a roof, a lawn, or a remodel and then get busy on the next job, so the quote goes cold without a single follow-up. Meanwhile, thrilled customers never get asked for a review, so your reputation lags behind the quality of your work. Both gaps cost you jobs you have already half-earned.",
    solution:
      "FlowForge automatically follows up on every quote with a friendly sequence that answers questions, offers to schedule, and nudges the customer to a decision, so more estimates turn into booked work. Once a job is complete, it texts satisfied customers a one-tap link to leave a review, steadily building the local reputation that wins your next lead.",
    steps: [
      { label: "Quote sent to the customer", tool: "Sheets" },
      { label: "Run smart follow-up sequence", tool: "GPT agent" },
      { label: "Book the job when they say yes", tool: "Calendly" },
      { label: "Request a review after completion", tool: "Twilio" },
    ],
    tools: ["GPT agent", "Twilio", "Calendly", "Gmail", "Google Reviews"],
    savings: "~$3,600/mo",
  },
  {
    slug: "ai-voice-receptionist-for-dental-practices",
    vertical: "Dental practices",
    workflow: "AI voice receptionist",
    h1: "AI voice receptionist for dental practices",
    metaTitle: "AI Voice Receptionist for Dental Practices | FlowForge AI",
    metaDescription:
      "Never send a patient to voicemail again. FlowForge answers, books, and reschedules appointments 24/7 with a natural-sounding AI phone agent.",
    problem:
      "Your front desk can only pick up one line at a time, so calls during the morning rush and after hours go straight to voicemail. Patients trying to book, reschedule, or ask a quick question hang up and call the practice down the street instead. Every unanswered ring is a chair you could have filled.",
    solution:
      "FlowForge deploys a 24/7 AI voice receptionist that answers every call in a natural voice, understands what the patient needs, and books, moves, or cancels appointments directly in your practice-management system. It confirms details by SMS, hands genuine emergencies to your team, and works nights and weekends so no caller ever hits a dead end.",
    steps: [
      { label: "Answer the inbound call", tool: "Twilio" },
      { label: "Understand the patient's request", tool: "GPT voice agent" },
      { label: "Book or reschedule the appointment", tool: "Calendly" },
      { label: "Confirm details by text", tool: "SMS" },
    ],
    tools: ["Twilio", "GPT voice agent", "Calendly", "SMS", "Sheets"],
    savings: "~$3,900/mo",
  },
  {
    slug: "ai-phone-agent-for-home-services",
    vertical: "Home services",
    workflow: "AI phone answering agent",
    h1: "AI phone answering agent for home services",
    metaTitle: "AI Phone Answering Agent for Home Services | FlowForge AI",
    metaDescription:
      "Capture every after-hours call and book the truck automatically. FlowForge answers, qualifies the job, and schedules the appointment while you work.",
    problem:
      "Calls come in while your crew is on a roof, under a house, or driving to the next job, and after 5pm they go unanswered entirely. Homeowners with a leak or a dead furnace do not leave a message; they call the next contractor on the list. Every missed call is a job handed to a competitor.",
    solution:
      "FlowForge answers every call with an AI phone agent that qualifies the job, gauges urgency, and captures the address and problem details in a natural conversation. It books the visit straight into your dispatch calendar and texts a confirmation, so after-hours and overflow calls turn into booked trucks instead of lost revenue.",
    steps: [
      { label: "Answer the inbound call", tool: "Twilio" },
      { label: "Qualify the job & urgency", tool: "GPT agent" },
      { label: "Book the visit on the calendar", tool: "Housecall Pro" },
      { label: "Text a confirmation", tool: "SMS" },
    ],
    tools: ["Twilio", "GPT agent", "Housecall Pro", "Jobber", "SMS"],
    savings: "~$5,400/mo",
  },
  {
    slug: "ai-voice-agent-for-law-firms",
    vertical: "Law firms",
    workflow: "AI intake call agent",
    h1: "AI intake call agent for law firms",
    metaTitle: "AI Intake Call Agent for Law Firms | FlowForge AI",
    metaDescription:
      "Answer every new-client call, screen for conflicts, and schedule consults automatically. FlowForge captures intake by phone so no case slips away.",
    problem:
      "A prospective client with an urgent legal problem calls the first firm that answers, and if that is not you, the case is gone. Your team cannot staff the phones through court, meetings, and after hours, so new-client calls hit voicemail during your busiest moments. Slow intake quietly bleeds away your best matters.",
    solution:
      "FlowForge answers new-client calls with an AI intake agent that gathers the caller's details, runs your standard intake and conflict-screening questions, and books qualified prospects into a consultation on your calendar. It routes true emergencies to an attorney and logs every call, so your firm captures more cases without adding front-desk staff.",
    steps: [
      { label: "Answer the new-client call", tool: "Twilio" },
      { label: "Run intake & conflict questions", tool: "GPT agent" },
      { label: "Schedule the consultation", tool: "Calendly" },
      { label: "Log the matter & details", tool: "Clio" },
    ],
    tools: ["Twilio", "GPT agent", "Clio", "Calendly"],
    savings: "~$4,700/mo",
  },
  {
    slug: "whatsapp-booking-agent-for-restaurants",
    vertical: "Restaurants",
    workflow: "WhatsApp booking & reservations agent",
    h1: "WhatsApp booking and reservations agent for restaurants",
    metaTitle: "WhatsApp Reservations & Booking Agent for Restaurants | FlowForge AI",
    metaDescription:
      "Take reservations and answer questions on WhatsApp in any language. FlowForge books tables and handles FAQs automatically, day and night.",
    problem:
      "Guests increasingly message on WhatsApp instead of calling, but no one on your team can watch the chat during service. Reservation requests, hours, and menu questions pile up unanswered while your staff runs the floor. Diners who do not get a quick reply simply book somewhere that answers.",
    solution:
      "FlowForge puts an AI agent on your WhatsApp Business line that takes reservations, answers questions about hours, menu, and dietary options, and replies in the guest's own language. It writes each confirmed booking straight into your reservation system and flags large parties for your team, so you fill more tables without watching your phone.",
    steps: [
      { label: "Guest messages on WhatsApp", tool: "WhatsApp Business API" },
      { label: "Answer FAQs in their language", tool: "GPT agent" },
      { label: "Take the reservation", tool: "OpenTable" },
      { label: "Log & confirm the booking", tool: "Sheets" },
    ],
    tools: ["WhatsApp Business API", "GPT agent", "OpenTable", "Sheets"],
    savings: "~$2,700/mo",
  },
  {
    slug: "whatsapp-sales-agent-for-ecommerce",
    vertical: "E-commerce",
    workflow: "WhatsApp sales & support agent",
    h1: "WhatsApp sales and support agent for e-commerce",
    metaTitle: "WhatsApp Sales & Support Agent for E-commerce | FlowForge AI",
    metaDescription:
      "Recover carts and answer order questions on WhatsApp automatically. FlowForge turns your busiest chat channel into a 24/7 sales and support agent.",
    problem:
      "Shoppers message your store on WhatsApp to ask about sizing, shipping, and their orders, but replies come hours later once someone is free. Abandoned carts never get a nudge on the channel customers actually read, and 'where is my order?' questions eat your team's day. Slow answers cost you both sales and loyalty.",
    solution:
      "FlowForge runs an AI sales and support agent on your WhatsApp Business line that answers product and order questions using live Shopify data, and follows up on abandoned carts with a personalized nudge and an optional incentive. It closes the sale in the chat and escalates anything tricky to a human, turning conversations into revenue around the clock.",
    steps: [
      { label: "Shopper messages or abandons a cart", tool: "WhatsApp Business API" },
      { label: "Pull live order & product data", tool: "Shopify" },
      { label: "Answer & recover the sale", tool: "GPT agent" },
      { label: "Close in chat or escalate", tool: "WhatsApp Business API" },
    ],
    tools: ["WhatsApp Business API", "Shopify", "GPT agent"],
    savings: "~$4,300/mo",
  },
  {
    slug: "ai-sales-follow-up-for-b2b-agencies",
    vertical: "B2B agencies",
    workflow: "AI sales follow-up (SDR) engine",
    h1: "AI sales follow-up and SDR engine for B2B agencies",
    metaTitle: "AI Sales Follow-Up (SDR) Engine for B2B Agencies | FlowForge AI",
    metaDescription:
      "Enrich leads, run multi-touch follow-up, and book meetings on autopilot. FlowForge is the tireless SDR that never lets a lead go cold.",
    problem:
      "New leads land in your CRM and sit there, because the team is heads-down delivering client work instead of chasing prospects. Follow-up is inconsistent, most leads get one email and then silence, and warm opportunities quietly go cold. You are leaving booked meetings on the table every single week.",
    solution:
      "FlowForge works your pipeline like a dedicated SDR: it enriches each new lead with firmographic data, writes personalized outreach, and runs a multi-touch email follow-up sequence until the prospect replies or opts out. When someone shows interest, it books the meeting straight onto your calendar and updates the CRM, so your pipeline moves without manual chasing.",
    steps: [
      { label: "Capture & enrich the lead", tool: "HubSpot" },
      { label: "Write personalized outreach", tool: "GPT agent" },
      { label: "Run multi-touch follow-up", tool: "Gmail" },
      { label: "Book the meeting", tool: "Calendly" },
    ],
    tools: ["HubSpot", "GPT agent", "Calendly", "Gmail"],
    savings: "~$5,100/mo",
  },
  {
    slug: "finance-automation-for-agencies",
    vertical: "Agencies & professional services",
    workflow: "Finance & back-office automation",
    h1: "Finance and back-office automation for agencies",
    metaTitle: "Finance & Back-Office Automation for Agencies | FlowForge AI",
    metaDescription:
      "Automate invoicing, AP/AR, dunning, and month-end prep. FlowForge keeps your books moving so cash comes in without the manual grind.",
    problem:
      "Invoices go out late, vendor bills get keyed in by hand, and overdue clients are not chased until cash gets tight. Month-end becomes a scramble of reconciling receipts and matching payments across tools. The busywork drains billable hours and lets both revenue and errors slip through.",
    solution:
      "FlowForge automates your back office end to end: it captures incoming bills and receipts, keys them into your accounting system, sends client invoices and polite dunning reminders on schedule, and matches payments as they arrive. It assembles a clean month-end package so your books stay current and your team stops drowning in finance admin.",
    steps: [
      { label: "Capture invoices & receipts", tool: "GPT agent" },
      { label: "Sync AP/AR to the ledger", tool: "QuickBooks" },
      { label: "Collect payments & run dunning", tool: "Stripe" },
      { label: "Assemble month-end package", tool: "Sheets" },
    ],
    tools: ["Stripe", "QuickBooks", "Xero", "GPT agent", "Sheets"],
    savings: "~$4,200/mo",
  },
  {
    slug: "review-management-for-local-services",
    vertical: "Local services",
    workflow: "Reviews & reputation engine",
    h1: "Reviews and reputation engine for local services",
    metaTitle: "Review Management & Reputation Engine for Local Services | FlowForge AI",
    metaDescription:
      "Earn more 5-star reviews and respond to every one automatically. FlowForge asks happy customers at the perfect moment and manages your reputation across Google and Yelp.",
    problem:
      "Your best customers walk away thrilled but never leave a review, because no one remembered to ask while the job was fresh. New reviews on Google and Yelp sit unanswered for weeks, and the occasional bad one lingers without a reply. Your online reputation ends up lagging far behind the quality of your work.",
    solution:
      "FlowForge texts satisfied customers a one-tap review link at the exact moment they are happiest, right after the job is done, so more five-star reviews roll in. It then monitors your Google Business Profile and Yelp listings and auto-drafts on-brand responses to every review, flagging negatives for a personal touch, so your reputation grows on autopilot.",
    steps: [
      { label: "Job completed", tool: "GPT agent" },
      { label: "Request a review by text", tool: "Twilio SMS" },
      { label: "Monitor new reviews", tool: "Google Business Profile" },
      { label: "Auto-draft on-brand responses", tool: "GPT agent" },
    ],
    tools: ["Google Business Profile", "GPT agent", "Twilio SMS"],
    savings: "~$3,200/mo",
  },
];
