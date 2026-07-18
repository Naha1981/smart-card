export default function MarketingHome() {
  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
      <p className="text-accent text-sm font-medium tracking-wide uppercase mb-4">SmartCart</p>
      <h1 className="text-4xl md:text-5xl font-semibold text-text max-w-2xl leading-tight">
        Every retailer hires an AI employee.
      </h1>
      <p className="text-text-dim max-w-xl mt-5">
        Shopify made it easy to open a store online. SmartCart makes it easy for any retailer to
        hire an AI employee that sells, serves, and learns — on WhatsApp, web, and beyond.
      </p>
      <a
        href="/onboarding"
        className="mt-8 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-bg"
      >
        Hire your AI employee
      </a>
    </main>
  );
}
